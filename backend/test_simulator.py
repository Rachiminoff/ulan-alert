import unittest
from datetime import datetime

import numpy as np
import pandas as pd

import ml
from features import FEATURES, HISTORY, compute_features, future_wet_label
from simulator import SyntheticWeather


def run(seed, month, days, scenario="natural"):
    s = SyntheticWeather(seed=seed, start=datetime(2026, month, 1), scenario=scenario)
    return [s.step() for _ in range(days * 1440)]


class SimulatorTests(unittest.TestCase):
    def test_seed_repeats_exact_sequence(self):
        a, b = SyntheticWeather(seed=123, start=datetime(2026, 8, 1)), SyntheticWeather(seed=123, start=datetime(2026, 8, 1))
        self.assertEqual([a.step() for _ in range(300)], [b.step() for _ in range(300)])

    def test_different_seeds_change_sequence(self):
        a, b = SyntheticWeather(seed=1, start=datetime(2026, 8, 1)), SyntheticWeather(seed=2, start=datetime(2026, 8, 1))
        self.assertNotEqual([a.step() for _ in range(10)], [b.step() for _ in range(10)])

    def test_sun_is_up_at_local_noon_and_down_at_night(self):
        rows = run(7, 4, 3, "sunny")                                   # sunny preset: no systems
        noon = [r.light_lux for r in rows if r.timestamp.hour == 12]
        night = [r.light_lux for r in rows if r.timestamp.hour in (0, 1, 2, 22, 23)]
        self.assertGreater(np.mean(noon), 60000)
        self.assertLess(np.mean(night), 1)

    def test_rain_now_is_wet_immediately(self):
        s = SyntheticWeather(seed=44, scenario="rain_now", start=datetime(2026, 8, 1, 14, 0))
        self.assertTrue(all(s.step().raining for _ in range(8)))

    def test_false_warning_never_rains(self):
        s = SyntheticWeather(seed=5, scenario="false_warning", start=datetime(2026, 2, 1, 12, 0))   # dry month: no random storms
        rows = [s.step() for _ in range(150)]
        self.assertEqual(sum(r.raining for r in rows), 0)
        self.assertGreater(max(r.humidity_pct for r in rows) - rows[0].humidity_pct, 3)

    def test_shower_preset_rains_after_a_visible_approach(self):
        s = SyntheticWeather(seed=9, scenario="shower", start=datetime(2026, 2, 1, 12, 0))
        rows = [s.step() for _ in range(120)]
        first = next(i for i, r in enumerate(rows) if r.raining)
        self.assertGreater(first, 15)                                   # precursors come first
        self.assertLess(rows[first - 1].pressure_hpa, rows[0].pressure_hpa - 0.4)

    def test_precursors_exist_before_natural_rain_onsets(self):
        rows = run(11, 8, 30)
        df = pd.DataFrame([(r.timestamp, r.pressure_hpa, r.humidity_pct, r.raining) for r in rows], columns=["t", "p", "h", "wet"])
        wet = df.wet.to_numpy()
        onsets = [i for i in range(200, len(df)) if wet[i] and not wet[i - 30:i].any()]
        self.assertGreater(len(onsets), 10)
        dp = np.mean([df.p[o - 1] - df.p[o - 31] for o in onsets])
        dh = np.mean([df.h[o - 1] - df.h[o - 31] for o in onsets])
        self.assertLess(dp, -0.3)        # falling pressure before rain
        self.assertGreater(dh, 1.0)      # rising humidity before rain

    def test_wet_season_is_wetter_than_dry_season(self):
        wet = sum(r.raining for r in run(3, 8, 20)); dry = sum(r.raining for r in run(3, 2, 20))
        self.assertGreater(wet, 3 * dry)


class FeatureTests(unittest.TestCase):
    def test_features_use_only_the_past(self):
        """Changing future rows must not change earlier features."""
        rows = run(21, 8, 2)
        df = pd.DataFrame([(r.timestamp, r.pressure_hpa, r.temperature_c, r.humidity_pct, r.light_lux) for r in rows],
                          columns=["timestamp", "pressure", "temperature", "humidity", "light"])
        F1 = compute_features(df)
        df2 = df.copy(); df2.loc[1500:, ["pressure", "humidity", "light", "temperature"]] *= 3
        F2 = compute_features(df2)
        pd.testing.assert_frame_equal(F1.iloc[:1500], F2.iloc[:1500])

    def test_live_window_matches_full_history(self):
        """Live inference uses a trailing window; it must equal the training-time features."""
        rows = run(22, 8, 2)
        df = pd.DataFrame([(r.timestamp, r.pressure_hpa, r.temperature_c, r.humidity_pct, r.light_lux) for r in rows],
                          columns=["timestamp", "pressure", "temperature", "humidity", "light"])
        full = compute_features(df).iloc[-5:]
        tail = compute_features(df.iloc[-(HISTORY + 4):].reset_index(drop=True)).iloc[-5:]
        np.testing.assert_allclose(full.to_numpy(), tail.to_numpy(), rtol=1e-9, atol=1e-9)

    def test_label_window(self):
        wet = np.zeros(100, bool); wet[50] = True
        y = future_wet_label(wet, 30)
        self.assertEqual(y[19], 0); self.assertEqual(y[20], 1); self.assertEqual(y[49], 1); self.assertEqual(y[50], 0)
        self.assertTrue(np.isnan(y[80]))


class AlertEvalTests(unittest.TestCase):
    def test_perfect_early_warning_counts_as_caught(self):
        n = 400; wet = np.zeros(n, bool); wet[300:320] = True
        prob = np.zeros(n); prob[270:300] = 0.9
        r = ml.merge_alert_evals([ml.alert_eval(prob, wet, 0.4)])
        self.assertEqual((r["events"], r["caught"], r["false_alarms"]), (1, 1, 0))
        self.assertGreaterEqual(r["median_lead_min"], 25)

    def test_warning_that_arrives_too_late_does_not_count(self):
        n = 400; wet = np.zeros(n, bool); wet[300:320] = True
        prob = np.zeros(n); prob[295:300] = 0.9
        r = ml.merge_alert_evals([ml.alert_eval(prob, wet, 0.4)])
        self.assertEqual(r["caught"], 0)

    def test_unfollowed_warning_is_a_false_alarm(self):
        n = 600; wet = np.zeros(n, bool); prob = np.zeros(n); prob[200:230] = 0.9
        r = ml.merge_alert_evals([ml.alert_eval(prob, wet, 0.4)])
        self.assertEqual(r["false_alarms"], 1)


class MLSkillTests(unittest.TestCase):
    def test_model_has_real_skill_on_unseen_sequences(self):
        """Small, fast version of the full protocol: train on 3 sequences, test on 2 unseen ones."""
        from sklearn.ensemble import HistGradientBoostingClassifier
        from sklearn.metrics import average_precision_score
        built = []
        for k, m in enumerate([7, 8, 9, 8, 7]):
            df = ml.simulate_sequence(900 + k, m, days=12)
            X = compute_features(df); y = future_wet_label(df["wet"].to_numpy())
            valid = (~X.isna().any(axis=1).to_numpy()) & (~np.isnan(y)) & (~df["wet"].to_numpy())
            built.append(ml.Seq(k, m, df, X, y, valid))
        Xtr, ytr = ml.stack(built[:3], 3); Xte, yte = ml.stack(built[3:], 1)
        clf = HistGradientBoostingClassifier(max_depth=4, max_iter=150, random_state=0).fit(Xtr, ytr)
        ap = average_precision_score(yte, clf.predict_proba(Xte)[:, 1])
        self.assertGreater(ap, 5 * yte.mean())      # >5x better than always guessing the base rate


if __name__ == "__main__":
    unittest.main()
