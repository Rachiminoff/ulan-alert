import tempfile
import unittest
from datetime import datetime
from functools import partial
from pathlib import Path
from unittest.mock import patch

import numpy as np

import main
from simulator import SyntheticWeather
from fastapi import HTTPException


class ConstantModel:
    """Deterministic above-threshold model for testing the preset timeline."""
    def predict_proba(self, features):
        return np.tile([0.35, 0.65], (len(features), 1))


class ScenarioEndpointTests(unittest.TestCase):
    def setUp(self):
        self.store_patch = patch.dict(main.store, {
            "models": {main.LIVE_MODEL: ConstantModel()},
            "medians": {},
            "ready": True,
        })
        self.store_patch.start()
        self.explain_patch = patch.object(main.ml, "explain", return_value=[])
        self.explain_patch.start()
        self.live_patch = patch.object(main, "live", main.Live())
        self.live_patch.start()

    def tearDown(self):
        self.live_patch.stop()
        self.explain_patch.stop()
        self.store_patch.stop()

    def test_scenario_selection_replays_preroll_without_advancing_clock(self):
        previous_timestamp = main.live.rows[-1]["timestamp"]
        previous_minute = main.live.sim.n

        result = main.change_scenario({"scenario": "cloud_build"})

        self.assertTrue(result["ok"])
        self.assertEqual(result["scenario"], "cloud_build")
        # The simulator is rewound and replayed to the same present, not advanced
        # by an extra minute just because the preset button was clicked.
        self.assertEqual(main.live.sim.n, previous_minute)
        self.assertEqual(main.live.rows[-1]["timestamp"], previous_timestamp)
        self.assertEqual(main.live.rows[-1]["scenario"], "cloud_build")
        self.assertAlmostEqual(main.live.probs[-1], 0.65)
        preset = next(
            system for system in main.live.sim.systems
            if system.n0 == previous_minute - (main.PRESETS["cloud_build"][2] - main.RAIN_AHEAD)
            and system.lead == main.PRESETS["cloud_build"][2]
        )
        self.assertEqual(preset.onset - main.live.sim.n, main.RAIN_AHEAD)

    def test_each_rain_preset_warns_at_least_ten_minutes_before_rain(self):
        rain_presets = [name for name, values in main.PRESETS.items() if values[4]]
        self.assertTrue(rain_presets)

        for name in rain_presets:
            with self.subTest(scenario=name):
                live = main.Live()
                with patch.object(main, "live", live):
                    result = main.change_scenario({"scenario": name})
                    self.assertTrue(result["ok"])
                    self.assertEqual(result["scenario"], name)
                    kind, strength, lead, duration, _ = main.PRESETS[name]
                    pre_roll = lead - main.RAIN_AHEAD
                    preset = next(
                        system for system in live.sim.systems
                        if system.n0 == live.sim.n - pre_roll
                        and system.lead == lead
                        and system.strength == strength
                    )
                    self.assertEqual(preset.onset - live.sim.n, main.RAIN_AHEAD)

                    click_index = len(live.rows) - 1
                    # Keep this regression focused on the selected system rather
                    # than stochastic background arrivals during the assertion.
                    live.sim.suppress = True
                    live._advance(main.RAIN_AHEAD + 5)
                    rows = list(live.rows)
                    first_rain = next(
                        (i for i in range(click_index + 1, len(rows)) if rows[i]["raining"]),
                        None,
                    )
                    self.assertIsNotNone(first_rain, "preset did not produce rain after selection")
                    lead_from_selection = first_rain - click_index
                    self.assertGreaterEqual(lead_from_selection, 10)
                    self.assertLessEqual(lead_from_selection, main.RAIN_AHEAD + 5)
                    recent_pressure = np.asarray([row["pressure"] for row in rows[click_index - pre_roll:click_index + 1]])
                    self.assertLess(
                        np.max(np.abs(np.diff(recent_pressure))),
                        0.50,
                        "the replayed precursor history should not contain an artificial pressure step",
                    )

                    probabilities = np.asarray(live.probs, dtype=float)
                    wet = np.zeros(len(probabilities), dtype=bool)
                    wet[first_rain:] = True
                    active = main.ml.warn_active(probabilities, wet, warn=0.40)
                    self.assertTrue(
                        active[first_rain - 10],
                        "warning should already be active at least 10 simulated minutes before rain",
                    )

    def test_preset_preroll_has_no_artificial_pressure_step_across_seeds(self):
        rain_presets = [name for name, values in main.PRESETS.items() if values[4]]
        for name in rain_presets:
            for seed in range(8):
                with self.subTest(scenario=name, seed=seed):
                    live = main.Live()
                    live.reset(seed=seed)
                    old_minute = live.sim.n
                    kind, strength, lead, duration, _ = main.PRESETS[name]
                    pre_roll = lead - main.RAIN_AHEAD
                    live.apply_scenario(name)
                    preset = next(
                        system for system in live.sim.systems
                        if system.n0 == old_minute - pre_roll
                        and system.lead == lead
                        and system.strength == strength
                    )
                    self.assertEqual(preset.onset - live.sim.n, main.RAIN_AHEAD)
                    pressure = np.asarray(
                        [row["pressure"] for row in list(live.rows)[-pre_roll - 1:]],
                        dtype=float,
                    )
                    self.assertLess(
                        np.max(np.abs(np.diff(pressure))),
                        0.50,
                        "the replayed approach should not contain a one-minute pressure step",
                    )

    def test_false_warning_is_a_no_rain_false_alarm_case(self):
        live = main.Live()
        with patch.object(main, "live", live):
            main.change_scenario({"scenario": "false_warning"})
            kind, strength, lead, duration, _ = main.PRESETS["false_warning"]
            pre_roll = lead - main.RAIN_AHEAD
            system = next(
                system for system in live.sim.systems
                if system.n0 == live.sim.n - pre_roll
                and system.lead == lead
                and system.strength == strength
            )
            self.assertFalse(system.rains)
            live.sim.suppress = True
            live._advance(90)

            rows = list(live.rows)
            probabilities = np.asarray(live.probs, dtype=float)
            wet = np.asarray([row["raining"] for row in rows], dtype=bool)
            self.assertFalse(wet[-90:].any())
            # The deliberately strong no-rain system resembles a rain system and
            # is expected to expose a false-positive alert in this demonstration.
            self.assertTrue(main.ml.warn_active(probabilities, wet, warn=0.40)[-30:].any())


class DeploymentRouteTests(unittest.TestCase):
    def test_frontend_route_serves_index_and_spa_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            dist = Path(directory)
            (dist / "index.html").write_text("<!doctype html><title>Ulan Alert</title>")
            with patch.object(main, "FRONTEND_DIST", dist):
                root_response = main.frontend_root()
                deep_link_response = main.frontend_assets("history")
                self.assertEqual(Path(root_response.path), dist / "index.html")
                self.assertEqual(Path(deep_link_response.path), dist / "index.html")

    def test_public_deployment_can_disable_model_retraining(self):
        with patch.object(main, "ENABLE_RETRAIN", False):
            with self.assertRaises(HTTPException) as error:
                main.retrain()
            self.assertEqual(error.exception.status_code, 403)


class LocationEndpointTests(unittest.TestCase):
    def fresh_live(self, seed=11):
        factory = partial(SyntheticWeather, start=datetime(2026, 2, 1, 12, 0))
        with patch.object(main, "SyntheticWeather", factory):
            live = main.Live()
            live.reset(seed=seed, scenario="natural")
        return live

    def test_reposting_the_same_location_does_not_reset_a_running_demo(self):
        with patch.object(main, "live", self.fresh_live()):
            loc = dict(main.live.location)
            stamp = main.live.rows[-1]["timestamp"]
            result = main.set_location({
                "name": loc["name"],
                "latitude": loc["latitude"],
                "longitude": loc["longitude"],
            })
            self.assertFalse(result["reset"])
            self.assertEqual(main.live.rows[-1]["timestamp"], stamp)

    def test_changing_location_resets_the_simulation(self):
        with patch.object(main, "live", self.fresh_live()):
            result = main.set_location({
                "name": "Elsewhere",
                "latitude": 35.0,
                "longitude": 139.0,
            })
            self.assertTrue(result["reset"])


if __name__ == "__main__":
    unittest.main()


class PredictionRealityTests(unittest.TestCase):
    def test_boolean_predictions_are_compared_only_after_full_horizon(self):
        rows = [
            {"timestamp": f"2026-01-01T00:{minute:02d}:00", "raining": minute == 5}
            for minute in range(40)
        ]
        probabilities = [0.8 if minute in (0, 7) else 0.1 for minute in range(40)]

        result = main.build_prediction_reality(rows, probabilities, "medium", 10)

        self.assertEqual(result["evaluated"], 10)
        self.assertEqual(result["pending"], 30)
        self.assertEqual(result["counts"]["true_positive"], 1)
        self.assertEqual(result["counts"]["false_positive"], 1)
        self.assertEqual(result["counts"]["false_negative"], 4)
        self.assertEqual(result["counts"]["true_negative"], 4)
        self.assertEqual(len(result["latest"]), 10)
        self.assertIsInstance(result["latest"][0]["predicted_rain"], bool)
        self.assertIsInstance(result["latest"][0]["actual_rain"], bool)

    def test_unknown_sensitivity_uses_medium_threshold(self):
        rows = [{"timestamp": str(i), "raining": False} for i in range(35)]
        result = main.build_prediction_reality(rows, [0.4] * 35, "unknown")
        self.assertEqual(result["sensitivity"], "medium")
        self.assertEqual(result["threshold"], 0.4)
