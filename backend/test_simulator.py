import unittest
from datetime import datetime
from simulator import SyntheticWeather

class SyntheticWeatherTests(unittest.TestCase):
    def test_seed_repeats_exact_sequence(self):
        a=SyntheticWeather(seed=123,start=datetime(2026,8,1))
        b=SyntheticWeather(seed=123,start=datetime(2026,8,1))
        self.assertEqual([a.step() for _ in range(30)],[b.step() for _ in range(30)])
    def test_different_seeds_change_sequence(self):
        a=SyntheticWeather(seed=1,start=datetime(2026,8,1))
        b=SyntheticWeather(seed=2,start=datetime(2026,8,1))
        self.assertNotEqual([a.step() for _ in range(10)],[b.step() for _ in range(10)])
    def test_rain_now_preset_produces_rain_sensor_state(self):
        s=SyntheticWeather(seed=44,scenario="rain_now",start=datetime(2026,8,1))
        self.assertTrue(all(s.step().raining for _ in range(10)))
    def test_false_warning_is_cloudy_without_forced_rain(self):
        s=SyntheticWeather(seed=5,scenario="false_warning",start=datetime(2026,8,1))
        rows=[s.step() for _ in range(10)]
        self.assertGreater(sum(r.humidity_pct for r in rows)/len(rows),65)
        self.assertLess(sum(r.raining for r in rows),10)
if __name__=="__main__": unittest.main()
