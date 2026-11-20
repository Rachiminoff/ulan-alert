import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

import main
from fastapi import HTTPException


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


if __name__ == "__main__":
    unittest.main()
