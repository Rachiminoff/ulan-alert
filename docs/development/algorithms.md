# Simulation and Machine-Learning Algorithms

This guide explains the implemented process in plain language while preserving the terminology used in the source code. It describes the synthetic environment and the current training pipeline; it does not claim that the model has been validated on physical sensor data.

## 1. Synthetic weather generation

`SyntheticWeather` produces one `WeatherState` per simulation step. The environment uses a seeded random generator, a simulated timestamp, a location, background atmospheric variation, and a collection of active weather systems.

### Weather-system model

The simulator represents weather development using systems with several phases:

1. **Approach:** environmental signals gradually change before possible rain. The simulated system may influence pressure, humidity, light/cloud conditions, and sometimes temperature.
2. **Onset:** the system reaches its configured rain-onset time if it is a rain-producing system.
3. **Rain:** the system produces simulated rainfall for its configured duration.
4. **Decay:** system effects gradually fade after the rain period.

Not every system produces rain. Some dissipate after showing precursor-like signals. This is important because a useful predictive model should learn a relationship with uncertainty, rather than a deterministic rule where every darkening sky or pressure fall guarantees rain.

The simulator also includes background variation and sensor noise. Light is shaped by a daylight curve and location-based solar-time adjustment. Seasonal wetness affects the rate at which systems may arrive. The code contains a Philippine monthly rainfall table for locations within its configured Philippine coordinate bounds and a broad heuristic for other locations.

### Plate wetness versus rainfall

The simulator exposes both rainfall amount and a `raining`/wet-plate state. The plate remains wet for a short dry-off interval after the last simulated drops. Consequently, the wet-state signal is a practical detection state, not a perfect timestamp of the first or last raindrop.

## 2. Input features

`backend/features.py` constructs 15 features from the current and historical values of pressure, humidity, temperature, light, and time of day.

| Feature | Plain-language meaning |
|---|---|
| `pressure_delta_10m` | Current pressure minus pressure 10 minutes earlier. |
| `pressure_delta_30m` | Current pressure minus pressure 30 minutes earlier. |
| `pressure_delta_1h` | Current pressure minus pressure 1 hour earlier. |
| `pressure_delta_3h` | Current pressure minus pressure 3 hours earlier. |
| `pressure_accel` | Difference between the latest 30-minute pressure change and the preceding 30-minute change. |
| `pressure_std_30m` | Pressure variability during the latest 30 minutes. |
| `humidity` | Current relative humidity. |
| `humidity_delta_30m` | Current humidity minus humidity 30 minutes earlier. |
| `temp_delta_10m` | Temperature change over 10 minutes. |
| `temp_delta_30m` | Temperature change over 30 minutes. |
| `temp_vs_3h_mean` | Current temperature relative to its rolling 3-hour mean. |
| `light_ratio` | Current light relative to its rolling 1-hour mean. |
| `clearness` | Light relative to expected clear-sky light for the time of day; used as a cloudiness proxy. |
| `hour_sin` | Sine encoding of time of day. |
| `hour_cos` | Cosine encoding of time of day. |

The rolling and lagged features require historical readings. The first rows of a sequence therefore contain missing feature values and are excluded from model fitting/evaluation when incomplete.

The same `compute_features()` function is used for training data and live inference. This avoids a common machine-learning problem called *training-serving skew*, where the model is trained using one feature calculation but receives differently calculated values when the application runs.

## 3. Prediction target

The current supervised target is a 30-minute binary label. For a given minute, the label is positive when the simulated rain plate becomes wet at least once in the following 30 minutes. It is negative when it does not become wet during that window.

The label is undefined for the final 30 rows of a sequence because the full future observation window is not available. Those rows are excluded from supervised evaluation.

This is not a five-minute or sixty-minute multi-horizon model. The primary classifier's target horizon is 30 minutes.

## 4. Training data and split design

`backend/ml.py` generates 18 independent 30-day synthetic sequences using different seeds and months. The split is performed by sequence, not by randomly selecting individual minutes:

- 9 sequences for training.
- 4 sequences for validation.
- 5 sequences for testing.

Keeping complete sequences in one split prevents neighboring minutes from the same simulated weather episode from being scattered across training and testing. This reduces the risk that near-duplicate time-adjacent observations make test performance look better than it should.

Training rows are sampled with a stride of three minutes to reduce the volume of highly similar neighboring examples. Validation rows use a stride of two; test rows use every valid minute.

The sequences are generated from a deterministic seed base in the source. The resulting data is synthetic and should be labelled as such in reports and interface text.

## 5. Candidate models and baselines

The current candidate classifiers are:

- **Logistic Regression:** a linear classification model trained after standardizing input features.
- **Decision Tree:** a tree-based model with configured depth and minimum leaf size.
- **Random Forest:** an ensemble of decision trees whose predictions are combined.
- **Gradient Boosting:** a sequential tree-boosting model that learns patterns by improving on earlier errors.

The pipeline also reports non-neural baselines:

- **Hour-of-day climatology:** estimates the positive rate for the relevant hour using training data. It uses time-of-day information rather than the weather sensor features.
- **Pressure/humidity rule:** a manually specified rule based on pressure change, humidity change, and current humidity. Its thresholds are selected using training data.
- **Majority baseline:** predicts the majority class and provides a simple reference point.

Baselines matter because a complex model should be compared with simpler alternatives. A score is more informative when readers can see whether the ML model improves on a straightforward reference.

## 6. Probability calibration

A classifier's raw probability-like score is not automatically a trustworthy probability. The code therefore fits an isotonic regression calibrator using the validation split. Isotonic calibration learns a monotonic mapping between model scores and observed frequencies.

The calibrated model combines the base classifier and calibrator in the `Calibrated` wrapper. The test split is reserved for reporting and is not used to fit the calibrator.

Calibration is assessed with Brier score and calibration bins, among other metrics. A well-calibrated model should, across groups of predictions, have observed event frequencies that broadly agree with its predicted probabilities. Calibration does not guarantee that every individual prediction is correct.

## 7. Probability threshold and warning behavior

The ML probability is converted into an alert state using thresholds and persistence rules. In the frontend, sensitivity maps to watch and warning thresholds. The client requires two consecutive polling observations at or above the warning threshold before entering warning state. A wet plate produces the raining state; offline connectivity produces the offline state.

The backend's event-level evaluation has its own replay rule: the probability must meet the selected warning threshold for two consecutive minutes, the plate must not currently be wet, and a refractory interval prevents an immediate post-rain warning. These rules are intended to evaluate alert episodes rather than treating every minute above threshold as a separate alarm.

The UI polling interval and simulated-time progression are different concepts. The frontend polls every two seconds, while the backend simulation can advance according to its configured simulation speed. Do not describe two frontend polls as necessarily representing two simulated minutes.

## 8. Evaluation metrics

### Row-level metrics

- **Precision:** Of the positive predictions, the fraction that were followed by rain within the target window.
- **Recall:** Of the positive target rows, the fraction identified by the model.
- **F1 score:** A combined measure of precision and recall.
- **PR-AUC:** Area under the precision-recall curve; useful when positive events are less common than negative ones.
- **ROC-AUC:** Measures ranking ability across classification thresholds.
- **Accuracy:** Fraction of all rows classified correctly at the selected threshold.
- **Brier score:** Mean squared difference between predicted probabilities and binary outcomes; lower is better.
- **Confusion matrix:** Counts true positives, false positives, false negatives, and true negatives.

### Event-level metrics

The application also evaluates warning episodes against rain events. A rain event is treated as a new onset after a configured dry quiet gap. The evaluation checks whether an alert occurred within a pre-onset window and whether it arrived with at least the configured useful lead time.

Reported event measures include event recall, median lead time, missed and late events, alert episodes, false alarms, false alarms per day, and alert precision. These answer a practical question that row-level metrics alone cannot: did the warning system alert in time for a person to react, and how often did it issue an unnecessary warning?

## 9. Model explanations and feature importance

`explain()` uses an occlusion-style method. It first obtains the current prediction, then replaces one feature at a time with that feature's training-set median and measures how much the probability changes. The largest absolute changes are returned as likely drivers.

This is a model-behavior explanation, not proof of causation. It indicates how the model output changes under a controlled feature replacement. It does not establish that a sensor variable physically caused rain.

The training pipeline also computes permutation importance for the Random Forest model. It shuffles one feature at a time and measures the drop in test PR-AUC. The reported values are normalized for display. The pipeline includes an ablation comparison that trains a Gradient Boosting model on selected sensor groups to examine their predictive contribution under the same split.

## 10. Limitations to state clearly

- Weather, sensors, and labels are generated by a synthetic simulator.
- Performance on synthetic sequences does not establish performance on real hardware or real local weather.
- The primary supervised target is rain-plate wetness within 30 minutes, not a detailed quantitative rainfall forecast.
- A rain-plate wet state includes a dry-off delay.
- Probability calibration is learned from synthetic validation data.
- Feature explanations describe model sensitivity, not physical causation.
- Event-level results depend on the alert threshold, consecutive-minute rule, refractory period, event quiet gap, and lead-time definition.
