import unittest
from unittest.mock import patch

import numpy as np

import main


class ConstantModel:
    def predict_proba(self, features):
        return np.tile([0.35, 0.65], (len(features), 1))


class ScenarioEndpointTests(unittest.TestCase):
    def test_scenario_change_recomputes_probability_before_returning(self):
        with patch.object(main, "live", main.Live()), \
             patch.dict(main.store, {
                 "models": {main.LIVE_MODEL: ConstantModel()},
                 "medians": {},
                 "ready": True,
             }), \
             patch.object(main.ml, "explain", return_value=[]):
            previous_timestamp = main.live.rows[-1]["timestamp"]

            result = main.change_scenario({"scenario": "cloud_build"})

            self.assertTrue(result["ok"])
            self.assertEqual(result["scenario"], "cloud_build")
            self.assertNotEqual(main.live.rows[-1]["timestamp"], previous_timestamp)
            self.assertEqual(main.live.rows[-1]["scenario"], "cloud_build")
            self.assertAlmostEqual(main.live.probs[-1], 0.65)


if __name__ == "__main__":
    unittest.main()
