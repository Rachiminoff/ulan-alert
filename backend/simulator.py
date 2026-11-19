"""RNG-driven synthetic weather for Indang, Cavite. Patterns are envelopes, RNG adds variation."""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta
import math
import random
import numpy as np


MONTH_RAIN = [29.6,18.0,20.3,34.9,172.0,252.5,427.2,432.6,365.5,223.0,158.5,98.4]
MONTH_TEMP = [24.6,25.1,26.3,27.5,27.3,26.4,25.6,25.6,25.7,25.8,25.6,24.9]
# Season tags are broad synthetic controls, not exact PAGASA boundaries.
SEASONS = {1:"dry",2:"dry",3:"dry",4:"dry",5:"transition",6:"wet",7:"wet",8:"wet",9:"wet",10:"wet",11:"latewet",12:"latewet"}
SCENARIOS = ["natural","sunny","cloud_build","shower","thunderstorm","habagat","false_warning","cool_evening","rain_now"]

@dataclass
class WeatherState:
    timestamp: datetime
    pressure_hpa: float
    temperature_c: float
    humidity_pct: float
    light_lux: float
    rain_mm: float
    raining: bool
    scenario: str

class SyntheticWeather:
    def __init__(self, seed=42, scenario="natural", start=None, latitude=14.1953, longitude=120.8769):
        self.rng = random.Random(seed)
        self.np_rng = np.random.default_rng(seed)
        self.scenario = scenario
        self.t = start or datetime.now().replace(second=0, microsecond=0)
        self.latitude = float(latitude)
        self.longitude = float(longitude)
        self.pressure = 1010 + self.rng.uniform(-2, 2)
        self.temp = max(8.0, 29.0 - 0.11 * abs(self.latitude))
        self.humidity = 72.0 + (8.0 if abs(self.latitude) < 23.5 else 0.0)
        self.cloud = 0.25
        self.rain_event_minutes = 0
        self.rain_probability = 0.0
        self.pressure_drift = 0.0
        self.temperature_bias = 0.0

    def set_scenario(self, scenario: str):
        if scenario not in SCENARIOS: scenario = "natural"
        self.scenario = scenario
        self.rain_event_minutes = 0
        self.rain_probability = 0.0
        self.pressure_drift = 0.0

    def step(self) -> WeatherState:
        self.t += timedelta(minutes=1)
        hour, month = self.t.hour, self.t.month
        solar_hour = (hour + self.longitude / 15.0) % 24
        # Broad location-dependent climate approximation for the demo. It is not a weather forecast.
        # Temperature varies with latitude; rainfall season shifts by hemisphere.
        lat_abs = min(66.0, abs(self.latitude))
        seasonal_temp = 29.0 - 0.11 * lat_abs + 5.0 * math.cos(2 * math.pi * (month - (7 if self.latitude >= 0 else 1)) / 12) * (lat_abs / 45.0)
        north = self.latitude >= 0
        if lat_abs < 23.5:
            wet_months = range(5, 11) if north else range(11, 13)
            wet = (month in wet_months) or (not north and month in range(1, 5))
            season = "wet" if wet else "dry"
            month_wetness = (0.8 if wet else 0.22) + 0.08 * math.sin(month / 12 * 2 * math.pi)
        else:
            season = "wet" if (month in (5,6,7,8,9) if north else month in (11,12,1,2,3)) else "dry"
            month_wetness = 0.48 if season == "wet" else 0.32
        month_wetness = max(0.1, min(1.0, month_wetness))
        # Daily temperature/light shape: sunrise/sunset smooth envelopes.
        daylight = max(0.0, math.sin(math.pi * (solar_hour-6) / 12)) if 6 <= solar_hour <= 18 else 0.0
        diurnal_temp = 2.4 * math.sin(2 * math.pi * (solar_hour-8) / 24)
        light_base = 85000 * daylight
        # Scenario pattern controls latent moisture/cloud/pressure tendencies.
        cloud_target, rain_force = 0.25, 0.0
        if self.scenario == "sunny": cloud_target, rain_force = 0.08, 0.0
        elif self.scenario == "cloud_build": cloud_target, rain_force = 0.70, 0.15
        elif self.scenario == "shower": cloud_target, rain_force = 0.82, 0.8
        elif self.scenario == "thunderstorm": cloud_target, rain_force = 0.94, 1.0
        elif self.scenario == "habagat": cloud_target, rain_force = 0.86, 0.75
        elif self.scenario == "false_warning": cloud_target, rain_force = 0.78, 0.05
        elif self.scenario == "cool_evening": cloud_target, rain_force = 0.20, 0.0
        elif self.scenario == "rain_now": cloud_target, rain_force = 0.98, 1.0
        else:
            wetness = month_wetness
            cloud_target = max(0.08, 0.22 + wetness * 0.45 + self.rng.uniform(-0.18, 0.18))
            rain_force = 0.0  # rain is event-driven in natural mode, not a constant drizzle tendency
            # Random localized convective burst: some rain events develop quickly.
            if self.rain_event_minutes == 0 and self.rng.random() < (0.00008 + wetness*0.00060):
                self.rain_event_minutes = self.rng.randint(12, 55)
                self.pressure_drift = self.rng.uniform(-1.7, -0.5)
        self.cloud += (cloud_target-self.cloud) * 0.10 + self.rng.gauss(0, 0.035)
        self.cloud = min(1, max(0, self.cloud))
        # Events are stochastic around the latent regime. Shower duration and intensity vary.
        p_rain = min(0.92, max(0.02, rain_force * (0.18 + self.cloud*0.72)))
        raining = True if self.scenario == "rain_now" else (self.rng.random() < (0.0008 if self.scenario == "natural" else p_rain))
        if self.rain_event_minutes > 0:
            raining = self.rng.random() < 0.72
            self.rain_event_minutes -= 1
        rain_mm = max(0.0, self.np_rng.gamma(1.5, 0.8)) if raining else 0.0
        # Pressure is noisy, but weakly linked to storm/cloud state, with occasional unrelated drift.
        self.pressure += self.rng.gauss(0, 0.035) + self.pressure_drift/60 - self.cloud*0.004
        self.pressure = min(1021, max(990, self.pressure))
        target_humidity = 64 + self.cloud*31 + (9 if raining else 0)
        target_humidity += (10 if season in ("wet", "latewet") else 0)
        self.humidity += (target_humidity-self.humidity)*0.08 + self.rng.gauss(0, 0.7)
        self.humidity = min(99, max(48, self.humidity))
        target_temp = seasonal_temp + diurnal_temp - self.cloud*1.8 - (1.5 if raining else 0)
        if self.scenario == "cool_evening": target_temp -= 2.0
        self.temp += (target_temp-self.temp)*0.12 + self.rng.gauss(0, 0.12)
        lux = light_base * (1-self.cloud*0.78) + self.rng.gauss(0, 1700)
        lux = max(0, min(100000, lux))
        if raining: self.pressure_drift = min(0.0, self.pressure_drift)
        elif self.rain_event_minutes == 0: self.pressure_drift *= 0.985
        return WeatherState(self.t, round(self.pressure, 1), round(self.temp, 1), round(self.humidity, 1),
                          round(lux), round(rain_mm, 2), raining, self.scenario)

