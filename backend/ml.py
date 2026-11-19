"""Dataset generation, training, calibration and honest evaluation for Ulan Alert.

Evaluation protocol
  * 18 independent 30-day simulated sequences (different seeds and months, dry + wet seasons).
  * Split BY SEQUENCE: 9 train / 4 validation / 5 test. No sequence is shared between splits, so there
    is no overlap between neighbouring minutes of train and test.
  * Validation set is used for isotonic probability calibration and threshold choice; the test set is
    touched once, for reporting.
  * Row-level metrics (PR-AUC, Brier, precision/recall) AND event-level metrics that replay the app's real
    alert rule (warn threshold, 2 consecutive predictions): events caught with >=10 min lead, median lead
    time, false alarms per day.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, confusion_matrix, f1_score, precision_recall_curve, precision_score, recall_score, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

from features import FEATURES, HISTORY, HORIZON, compute_features, future_wet_label
from simulator import SyntheticWeather

SEQ_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 6, 7, 8, 9, 10, 5]
TEST_IDX, VAL_IDX = {1, 6, 9, 11, 15}, {3, 7, 13, 16}      # Feb, Jul, Oct, Dec, Sep | Apr, Aug, Jun, Oct
SEED0 = 2026
DAYS = 30
TRAIN_STRIDE = 3          # keep every 3rd minute for fitting (neighbouring minutes are near-duplicates)
WARN_DEFAULT = 0.40
SWEEP = [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7]
CONSEC = 2
MIN_LEAD = 10             # a warning is "useful" if it is active at least 10 minutes before rain


# ------------------------------------------------------------------ data
def simulate_sequence(seed: int, month: int, days: int = DAYS) -> pd.DataFrame:
    sim = SyntheticWeather(seed=seed, start=datetime(2026, month, 1, 0, 0))
    recs = []
    for _ in range(days * 1440):
        s = sim.step()
        recs.append((s.timestamp, s.pressure_hpa, s.temperature_c, s.humidity_pct, s.light_lux, s.rain_mm, s.raining))
    df = pd.DataFrame(recs, columns=["timestamp", "pressure", "temperature", "humidity", "light", "rain_mm", "wet"])
    return df


@dataclass
class Seq:
    idx: int
    month: int
    df: pd.DataFrame          # raw minute data
    X: pd.DataFrame           # features (NaN warm-up)
    y: np.ndarray             # future-wet label (NaN if undefined)
    valid: np.ndarray         # usable rows: features ok, label ok, plate currently dry


def build_sequences(n_seq=len(SEQ_MONTHS), days=DAYS):
    out = []
    for k in range(n_seq):
        df = simulate_sequence(SEED0 + k, SEQ_MONTHS[k], days)
        X = compute_features(df)
        y = future_wet_label(df["wet"].to_numpy())
        valid = (~X.isna().any(axis=1).to_numpy()) & (~np.isnan(y)) & (~df["wet"].to_numpy())
        out.append(Seq(k, SEQ_MONTHS[k], df, X, y, valid))
    return out


def stack(seqs, stride=1):
    Xs, ys = [], []
    for s in seqs:
        ix = np.flatnonzero(s.valid)[::stride]
        Xs.append(s.X.iloc[ix].to_numpy(float)); ys.append(s.y[ix])
    return np.vstack(Xs), np.concatenate(ys).astype(int)


# ------------------------------------------------------------------ models
class Calibrated:
    """Model + isotonic calibrator fitted on a held-out validation split."""
    def __init__(self, model, iso):
        self.model, self.iso = model, iso

    def predict_proba(self, X):
        p = self.iso.predict(self.model.predict_proba(X)[:, 1])
        return np.column_stack([1 - p, p])


def candidates():
    return {
        "Logistic Regression": make_pipeline(StandardScaler(), LogisticRegression(C=1.0, max_iter=2000)),
        "Decision Tree": DecisionTreeClassifier(max_depth=6, min_samples_leaf=60, random_state=42),
        "Random Forest": RandomForestClassifier(n_estimators=160, max_depth=11, min_samples_leaf=25,
                                                max_features="sqrt", random_state=42, n_jobs=-1),
        "Gradient Boosting": HistGradientBoostingClassifier(max_depth=4, learning_rate=0.06, max_iter=220,
                                                            l2_regularization=1.0, random_state=42),
    }


# ------------------------------------------------------------------ event-level evaluation
def warn_active(prob: np.ndarray, wet: np.ndarray, warn=WARN_DEFAULT, consec=CONSEC, refractory=30) -> np.ndarray:
    """Replay the app rule: probability >= warn on `consec` consecutive minutes, never while the plate is wet,
    and not for `refractory` minutes after rain (a post-rain 'bring laundry in' alert is meaningless)."""
    n = len(prob)
    over = np.nan_to_num(prob, nan=0.0) >= warn
    run = pd.Series(over.astype(int)).rolling(consec).sum().fillna(0).to_numpy() >= consec
    recent_wet = pd.Series(wet.astype(float)).rolling(refractory + 1, min_periods=1).max().to_numpy() > 0
    return run & ~recent_wet


def alert_eval(prob, wet, warn=WARN_DEFAULT, min_lead=MIN_LEAD, window=60, quiet_gap=30):
    """Event-level skill. Events = rain onsets after >= quiet_gap dry minutes."""
    wet = np.asarray(wet, bool)
    n = len(wet)
    act = warn_active(prob, wet, warn)
    onsets = [i for i in range(1, n) if wet[i] and not wet[max(0, i - quiet_gap):i].any()]
    onsets = [o for o in onsets if o >= HISTORY]
    caught, late, leads = 0, 0, []
    for o in onsets:
        lo, hi = max(0, o - window), o - min_lead
        seg = act[lo:hi + 1] if hi >= lo else np.array([], bool)
        if seg.any():
            caught += 1
            t = lo + int(np.flatnonzero(seg)[-1])       # latest active minute that is still >= min_lead early
            while t > 0 and act[t - 1] and t - 1 >= o - window:
                t -= 1
            leads.append(o - t)
        elif act[max(0, o - min_lead + 1):o].any():
            late += 1
    # alert episodes (merge gaps < 15 min)
    eps, i = [], 0
    while i < n:
        if act[i]:
            j = i
            while j + 1 < n and (act[j + 1] or act[j + 1:j + 16].any()):
                j += 1
            eps.append((i, j)); i = j + 1
        else:
            i += 1
    false_alarms = sum(1 for a, b in eps if not wet[a:min(n, b + HORIZON + 1)].any())
    return {"events": len(onsets), "caught": caught, "late": late, "missed": len(onsets) - caught - late,
            "leads": leads, "episodes": len(eps), "false_alarms": false_alarms, "minutes": n}


def merge_alert_evals(evals):
    ev = sum(e["events"] for e in evals); ca = sum(e["caught"] for e in evals)
    leads = [x for e in evals for x in e["leads"]]
    fa = sum(e["false_alarms"] for e in evals); ep = sum(e["episodes"] for e in evals)
    days = sum(e["minutes"] for e in evals) / 1440.0
    return {"events": ev, "caught": ca, "late": sum(e["late"] for e in evals), "missed": sum(e["missed"] for e in evals),
            "event_recall": ca / ev if ev else 0.0,
            "median_lead_min": float(np.median(leads)) if leads else 0.0,
            "episodes": ep, "false_alarms": fa, "false_alarms_per_day": fa / days if days else 0.0,
            "alert_precision": (ep - fa) / ep if ep else 0.0, "days": round(days, 1)}


# ------------------------------------------------------------------ row-level metrics
def row_metrics(y, prob, thr):
    pred = prob >= thr
    cm = confusion_matrix(y, pred, labels=[0, 1]).tolist()
    return {"precision": float(precision_score(y, pred, zero_division=0)),
            "recall": float(recall_score(y, pred, zero_division=0)),
            "f1": float(f1_score(y, pred, zero_division=0)),
            "pr_auc": float(average_precision_score(y, prob)),
            "roc_auc": float(roc_auc_score(y, prob)) if 0 < y.mean() < 1 else 0.0,
            "accuracy": float((pred == y).mean()), "brier": float(brier_score_loss(y, prob)),
            "confusion_matrix": cm, "threshold": float(thr)}


def calibration_bins(y, prob, bins=10):
    edges = np.linspace(0, 1, bins + 1)
    out = []
    for a, b in zip(edges[:-1], edges[1:]):
        m = (prob >= a) & (prob < b if b < 1 else prob <= b)
        if m.sum() >= 30:
            out.append({"mean_pred": float(prob[m].mean()), "observed": float(y[m].mean()), "n": int(m.sum())})
    return out


def fit_rule(Xtr, ytr):
    """Hand-written baseline (pressure falling + humidity rising + humid), thresholds grid-searched on TRAIN only."""
    ix = {k: FEATURES.index(k) for k in ("pressure_delta_1h", "humidity_delta_30m", "humidity")}
    best = (-1, None)
    for dp in (-0.3, -0.5, -0.8, -1.2):
        for dh in (0.5, 1.0, 2.0, 3.0):
            for hm in (70, 75, 80):
                pred = (Xtr[:, ix["pressure_delta_1h"]] < dp) & (Xtr[:, ix["humidity_delta_30m"]] > dh) & (Xtr[:, ix["humidity"]] > hm)
                f = f1_score(ytr, pred, zero_division=0)
                if f > best[0]:
                    best = (f, (dp, dh, hm))
    dp, dh, hm = best[1]

    def rule(X):
        return ((X[:, ix["pressure_delta_1h"]] < dp) & (X[:, ix["humidity_delta_30m"]] > dh) & (X[:, ix["humidity"]] > hm)).astype(float)
    return rule, {"pressure_delta_1h_below": dp, "humidity_delta_30m_above": dh, "humidity_above": hm}


# ------------------------------------------------------------------ training entry point
def train_all(progress=None):
    t0 = time.time()
    seqs = build_sequences()
    tr = [s for s in seqs if s.idx not in TEST_IDX | VAL_IDX]
    va = [s for s in seqs if s.idx in VAL_IDX]
    te = [s for s in seqs if s.idx in TEST_IDX]
    Xtr, ytr = stack(tr, TRAIN_STRIDE); Xva, yva = stack(va, 2); Xte, yte = stack(te, 1)

    models, metrics, event_probs = {}, {}, {}
    test_prob_by_seq = {}

    def seq_probs(predict, s):
        p = np.full(len(s.df), np.nan)
        ok = ~s.X.isna().any(axis=1).to_numpy()
        p[ok] = predict(s.X.to_numpy(float)[ok])
        return p

    # hour-of-day climatology baseline (prior only; no weather information)
    hr_ix = FEATURES.index("hour_sin"), FEATURES.index("hour_cos")
    def hour_bin(X):
        ang = np.arctan2(X[:, hr_ix[0]], X[:, hr_ix[1]]); return (((ang / (2 * np.pi)) % 1.0) * 24).astype(int) % 24
    prior = np.array([ytr[hour_bin(Xtr) == h].mean() if (hour_bin(Xtr) == h).any() else ytr.mean() for h in range(24)])
    clim = lambda X: prior[hour_bin(X)]

    rule, rule_params = fit_rule(Xtr, ytr)

    for name, base in candidates().items():
        base.fit(Xtr, ytr)
        iso = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(base.predict_proba(Xva)[:, 1], yva)
        m = Calibrated(base, iso)
        models[name] = m
        prob = m.predict_proba(Xte)[:, 1]
        metrics[name] = row_metrics(yte, prob, WARN_DEFAULT)
        # threshold chosen on validation (max F1), reported on test
        pv = m.predict_proba(Xva)[:, 1]
        pr, rc, th = precision_recall_curve(yva, pv)
        f1s = 2 * pr * rc / np.maximum(pr + rc, 1e-9)
        best_thr = float(th[int(np.argmax(f1s[:-1]))]) if len(th) else WARN_DEFAULT
        metrics[name]["val_best_f1_threshold"] = best_thr
        metrics[name]["calibration"] = calibration_bins(yte, prob)
        pr_t, rc_t, _ = precision_recall_curve(yte, prob)
        step = max(1, len(pr_t) // 60)
        metrics[name]["pr_curve"] = [{"recall": float(r), "precision": float(p)} for p, r in zip(pr_t[::step], rc_t[::step])]
        metrics[name]["alert_eval"] = merge_alert_evals(
            [alert_eval(seq_probs(lambda X, m=m: m.predict_proba(X)[:, 1], s), s.df["wet"].to_numpy(), WARN_DEFAULT) for s in te])
        tp = [seq_probs(lambda X, m=m: m.predict_proba(X)[:, 1], s) for s in te]
        metrics[name]["operating_curve"] = [
            {"threshold": thr, **merge_alert_evals([alert_eval(p, s.df["wet"].to_numpy(), thr) for p, s in zip(tp, te)])} for thr in SWEEP]
        if progress: progress(name)

    # baselines
    pc = clim(Xte)
    metrics["Hour-of-day climatology"] = row_metrics(yte, pc, float(np.quantile(pc, 0.9)))
    metrics["Hour-of-day climatology"]["alert_eval"] = merge_alert_evals(
        [alert_eval(seq_probs(clim, s), s.df["wet"].to_numpy(), float(np.quantile(pc, 0.9))) for s in te])
    pr_rule = rule(Xte)
    mr = row_metrics(yte, pr_rule, 0.5); mr["pr_auc"] = float(average_precision_score(yte, pr_rule)); mr["rule_params"] = rule_params
    mr["alert_eval"] = merge_alert_evals([alert_eval(seq_probs(rule, s), s.df["wet"].to_numpy(), 0.5) for s in te])
    metrics["Pressure/humidity rule"] = mr
    prev = float(yte.mean())
    metrics["Majority baseline"] = {"precision": 0.0, "recall": 0.0, "f1": 0.0, "pr_auc": prev, "roc_auc": 0.5, "accuracy": 1 - prev,
                                    "brier": float(brier_score_loss(yte, np.zeros_like(yte))), "confusion_matrix": confusion_matrix(yte, np.zeros_like(yte), labels=[0, 1]).tolist(), "threshold": 0.0}

    # ablation: what does each sensor group contribute? (Gradient Boosting, same split)
    groups = {"pressure only": [f for f in FEATURES if f.startswith("pressure")],
              "humidity only": ["humidity", "humidity_delta_30m"],
              "light only": ["light_ratio", "clearness"],
              "temperature only": ["temp_delta_10m", "temp_delta_30m", "temp_vs_3h_mean"],
              "all except pressure": [f for f in FEATURES if not f.startswith("pressure")],
              "all sensors": FEATURES}
    ablation = []
    for g, cols in groups.items():
        ci = [FEATURES.index(c) for c in cols]
        mdl = HistGradientBoostingClassifier(max_depth=4, learning_rate=0.06, max_iter=220, l2_regularization=1.0, random_state=42)
        mdl.fit(Xtr[:, ci], ytr)
        ablation.append({"features": g, "pr_auc": float(average_precision_score(yte, mdl.predict_proba(Xte[:, ci])[:, 1]))})
    # permutation importance on test (model-agnostic, honest)
    best = "Random Forest"
    rng = np.random.default_rng(0)
    base_ap = average_precision_score(yte, models[best].predict_proba(Xte)[:, 1])
    imp = []
    sub = rng.choice(len(Xte), size=min(12000, len(Xte)), replace=False)
    Xs, ys = Xte[sub], yte[sub]
    base_ap = average_precision_score(ys, models[best].predict_proba(Xs)[:, 1])
    for j, f in enumerate(FEATURES):
        drops = []
        for _ in range(2):
            Xp = Xs.copy(); Xp[:, j] = rng.permutation(Xp[:, j])
            drops.append(base_ap - average_precision_score(ys, models[best].predict_proba(Xp)[:, 1]))
        imp.append({"feature": f, "importance": float(max(0.0, np.mean(drops)))})
    tot = sum(d["importance"] for d in imp) or 1.0
    for d in imp:
        d["importance"] /= tot
    imp.sort(key=lambda d: d["importance"], reverse=True)

    metrics["meta"] = {
        "rows": int(len(Xtr) * TRAIN_STRIDE + len(Xva) * 2 + len(Xte)), "train_rows": int(len(Xtr)), "val_rows": int(len(Xva)), "test_rows": int(len(Xte)),
        "positive_rate_train": float(ytr.mean()), "positive_rate_test": prev, "sequences": len(seqs), "days_per_sequence": DAYS,
        "split": "by independent sequence: 9 train / 4 validation / 5 test", "calibration": "isotonic, fitted on validation split",
        "features": FEATURES, "seed": SEED0, "synthetic": True, "warn_threshold": WARN_DEFAULT, "consecutive_required": CONSEC,
        "min_lead_minutes": MIN_LEAD, "train_seconds": round(time.time() - t0, 1), "live_model": "Random Forest",
        "test_months": sorted({SEQ_MONTHS[i] for i in TEST_IDX}),
    }
    metrics["feature_importance"] = imp
    metrics["ablation"] = sorted(ablation, key=lambda d: -d["pr_auc"])

    # medians for live explanation (occlusion baseline)
    medians = np.median(Xtr, axis=0)
    return models, metrics, medians


def explain(model, x: np.ndarray, medians: np.ndarray, top=3):
    """Occlusion explanation: how much does the probability change if a feature is set to its typical value?"""
    base = float(model.predict_proba(x[None, :])[0, 1])
    X = np.repeat(x[None, :], len(FEATURES), axis=0)
    for j in range(len(FEATURES)):
        X[j, j] = medians[j]
    p = model.predict_proba(X)[:, 1]
    eff = base - p
    # merge the two time-of-day features
    out = {}
    from features import LABELS
    for j, f in enumerate(FEATURES):
        out[LABELS[f]] = out.get(LABELS[f], 0.0) + float(eff[j])
    items = sorted(out.items(), key=lambda kv: -abs(kv[1]))[:top]
    return [{"driver": k, "effect": round(v, 3)} for k, v in items if abs(v) > 0.005]
