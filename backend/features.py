"""Single source of truth for features. Training and live inference both call compute_features(),
so there is no training/serving skew. Every feature looks only at the past (<= 180 minutes)."""
from __future__ import annotations

import numpy as np
import pandas as pd

from simulator import CLEAR_SKY_LUX, daylight_fraction

HISTORY = 181          # rows of history needed for the longest feature
HORIZON = 30           # label: rain-plate wet at any time in the next 30 minutes

FEATURES = [
    "pressure_delta_10m", "pressure_delta_30m", "pressure_delta_1h", "pressure_delta_3h",
    "pressure_accel", "pressure_std_30m",
    "humidity", "humidity_delta_30m",
    "temp_delta_10m", "temp_delta_30m", "temp_vs_3h_mean",
    "light_ratio", "clearness",
    "hour_sin", "hour_cos",
]

DEFINITIONS = {
    "pressure_delta_10m": "Pressure now minus 10 minutes ago (sharp falls just before onset)",
    "pressure_delta_30m": "Pressure now minus 30 minutes ago",
    "pressure_delta_1h": "Pressure now minus 1 hour ago",
    "pressure_delta_3h": "Pressure now minus 3 hours ago",
    "pressure_accel": "Is the pressure fall speeding up? (last 30 min change minus the 30 min before)",
    "pressure_std_30m": "Pressure variability over the last 30 minutes",
    "humidity": "Current relative humidity",
    "humidity_delta_30m": "Humidity change over 30 minutes",
    "temp_delta_10m": "Temperature change over 10 minutes (cold outflow from approaching storms)",
    "temp_delta_30m": "Temperature change over 30 minutes",
    "temp_vs_3h_mean": "Temperature minus its own 3-hour average",
    "light_ratio": "Light now divided by its 1-hour mean (sky darkening)",
    "clearness": "Light divided by the expected clear-sky light for this hour (cloud cover proxy)",
    "hour_sin": "Time of day, sine encoding",
    "hour_cos": "Time of day, cosine encoding",
}

LABELS = {
    "pressure_delta_10m": "Pressure change, 10 min", "pressure_delta_30m": "Pressure change, 30 min",
    "pressure_delta_1h": "Pressure change, 1 h", "pressure_delta_3h": "Pressure change, 3 h",
    "pressure_accel": "Pressure fall accelerating", "pressure_std_30m": "Pressure jitter",
    "humidity": "Humidity level", "humidity_delta_30m": "Humidity rising",
    "temp_delta_10m": "Sudden cooling", "temp_delta_30m": "Temperature trend",
    "temp_vs_3h_mean": "Cooler than recent hours", "light_ratio": "Sky darkening",
    "clearness": "Cloud cover (from light)", "hour_sin": "Time of day", "hour_cos": "Time of day",
}


def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    """df: one row per minute with columns timestamp, pressure, temperature, humidity, light.
    Returns a frame (same index) with FEATURES; the first HISTORY-1 rows are NaN."""
    p, t, h, l = df["pressure"], df["temperature"], df["humidity"], df["light"]
    ts = pd.to_datetime(df["timestamp"])
    hour = (ts.dt.hour + ts.dt.minute / 60.0).to_numpy()
    clear = np.array([CLEAR_SKY_LUX * daylight_fraction(x) for x in hour])
    f = pd.DataFrame(index=df.index)
    f["pressure_delta_10m"] = p - p.shift(10)
    f["pressure_delta_30m"] = p - p.shift(30)
    f["pressure_delta_1h"] = p - p.shift(60)
    f["pressure_delta_3h"] = p - p.shift(180)
    f["pressure_accel"] = (p - p.shift(30)) - (p.shift(30) - p.shift(60))
    f["pressure_std_30m"] = p.rolling(30).std()
    f["humidity"] = h
    f["humidity_delta_30m"] = h - h.shift(30)
    f["temp_delta_10m"] = t - t.shift(10)
    f["temp_delta_30m"] = t - t.shift(30)
    f["temp_vs_3h_mean"] = t - t.rolling(180).mean()
    f["light_ratio"] = l / (l.rolling(60).mean() + 1.0)
    f["clearness"] = np.where(clear > 2000, np.clip(l / (clear + 1.0), 0, 1.5), 1.0)
    f["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    f["hour_cos"] = np.cos(2 * np.pi * hour / 24)
    return f[FEATURES]


def future_wet_label(wet: np.ndarray, horizon: int = HORIZON) -> np.ndarray:
    """1 where the plate becomes wet at any minute in (i, i+horizon]; NaN where the window is incomplete."""
    n = len(wet)
    c = np.concatenate([[0], np.cumsum(wet.astype(np.int64))])
    out = np.full(n, np.nan)
    idx = np.arange(0, n - horizon)
    out[idx] = ((c[idx + 1 + horizon] - c[idx + 1]) > 0).astype(float)
    return out
