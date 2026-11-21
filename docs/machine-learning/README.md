# Machine Learning Methodology

## 1. What the model predicts

The classification target is `rain_next_30min`. It is positive when the simulated rain plate becomes wet at any point during the next 30 minutes. Rows where the plate is already wet are excluded from the usable training examples. Incomplete future windows are not assigned a label.

In plain language, the model estimates whether the simulated rain sensor is likely to register wet conditions within the next half hour. It does not predict exact rainfall quantity, storm track, or official weather conditions.

## 2. Training data

Training examples are created by running the synthetic weather simulator over multiple 30-day sequences. The current configuration defines 18 sequences across selected months, using different seeds. The month selection includes dry and wetter periods so the training and evaluation process is not limited to one seasonal pattern.

Each sequence is generated independently. This is important because adjacent minutes from the same simulated weather event are highly related; randomly splitting individual rows could put nearly identical moments into both training and test data.

## 3. Feature engineering

`backend/features.py` is the single source of truth for feature generation. Both model training and live inference call `compute_features()`. Sharing the same function helps prevent a mismatch between the data representation used during training and the data representation used when the application is running.

The current feature set contains 15 values:

| Feature group | What it describes |
|---|---|
| Pressure changes | Difference between current pressure and pressure 10 minutes, 30 minutes, 1 hour, and 3 hours earlier |
| Pressure behavior | Whether pressure change is accelerating and how variable pressure has been over 30 minutes |
| Humidity | Current relative humidity and its 30-minute change |
| Temperature | 10-minute and 30-minute changes, plus difference from the recent 3-hour mean |
| Light | Current light relative to its 1-hour mean and relative to expected clear-sky light |
| Time of day | Sine and cosine encoding of the local hour, allowing the day cycle to wrap smoothly |

The longest lookback is three hours. The implementation requires 181 rows of minute history to support the longest feature window. Features use current and past readings only; they must not inspect future sensor values.

## 4. Dataset splitting

The current protocol uses 18 independent 30-day sequences:

- 9 sequences for training.
- 4 sequences for validation.
- 5 sequences for testing.

The split is performed by sequence, not by randomly mixing individual rows. This reduces leakage from neighboring minutes and shared weather events. The validation data is used for probability calibration and warning-threshold selection. The test data is reserved for final reporting in the evaluation pipeline.

Training uses a stride of three minutes when stacking examples to reduce the number of near-duplicate neighboring rows used for fitting. This does not change the underlying minute-by-minute simulation.

## 5. Candidate models and baseline methods

The implementation compares four supervised classifiers:

- **Logistic Regression:** a linear classification model that provides a relatively simple reference point.
- **Decision Tree:** a tree-based model that makes decisions through a sequence of feature-based splits.
- **Random Forest:** an ensemble of decision trees. This is the model used for the live prediction path.
- **Gradient Boosting:** an ensemble that builds trees in sequence, with later trees correcting errors made by earlier ones.

The evaluation also includes baseline approaches: a majority-class baseline, hour-of-day climatology, and a pressure/humidity rule whose thresholds are tuned using training data only.

## 6. Probability calibration and warning threshold

A classifier's raw score is not automatically a trustworthy probability. The code fits an isotonic calibration step using held-out validation data. Calibration adjusts model scores so that predictions can be interpreted more meaningfully as estimated frequencies, subject to the limits of the synthetic dataset.

The application also uses warning thresholds. The ML evaluation sweeps candidate thresholds and examines their trade-offs. The frontend has sensitivity levels with separate watch and warning thresholds. A warning state additionally requires repeated threshold exceedance; it is not triggered by a single high score alone.

## 7. Evaluation

The implementation reports row-level and event-level measures.

### Row-level measures

- **PR-AUC:** summarizes precision and recall trade-offs, particularly useful when positive rain-onset examples are uncommon.
- **ROC-AUC:** measures how well scores rank positive examples above negative examples across thresholds.
- **Brier score:** measures the squared error of predicted probabilities; lower is better.
- **Precision, recall, and F1:** evaluate classification at a selected warning threshold.
- **Calibration/reliability bins:** compare predicted probability ranges with observed positive frequencies.
- **Precision-recall curve:** shows precision-recall behavior across thresholds.

### Event-level measures

The event evaluation replays the application's warning rule. It examines whether distinct rain events were warned about at least ten minutes before onset, the median lead time for caught events, and false alarms per day. An operating curve illustrates how these outcomes change as the warning threshold changes.

Event-level measures are important because a sequence of many positive minute-level predictions may represent one practical warning episode rather than many separate useful alerts.

## 8. Feature analysis

The code includes sensor-group ablation and permutation-importance analysis on the test set. Ablation evaluates how performance changes when a group of inputs is removed. Permutation importance measures how much a metric changes when a feature's values are shuffled, disrupting its relationship with the target.

The live status response can also include an explanation of the top contributing drivers. Such explanations should be understood as model-based indications, not proof that a particular sensor change caused rain.

## 9. Live inference

The running simulation accumulates its own history. The backend applies the same feature function used during training and obtains a probability from the live Random Forest model. The status endpoint exposes the current probability and related information. The Research Lab endpoints provide additional live traces and evaluation views.

The model needs sufficient historical readings before all rolling features are available. Early rows can therefore be unavailable for inference until the history warm-up period has passed.

## 10. Limitations and reporting guidance

The model is trained and evaluated using data generated by the same simulator family. It measures whether the model can recover patterns intentionally represented in that synthetic environment. It does not establish accuracy on real weather or physical sensor data.

When reporting results, identify them as simulation-based. Do not describe a test-set score as field accuracy, operational reliability, or proof that the system can forecast real rainfall. Real-world validation would require collecting and evaluating independent sensor observations.
