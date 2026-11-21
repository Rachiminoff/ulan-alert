# Research Context, Interpretation, and Limitations

## 1. Project framing

Ulan Alert is presented as an automated smart-clothesline prototype using IoT architecture concepts, human-computer interaction, and supervised machine-learning algorithms for predictive precipitation detection. The current repository implements a software simulation of the data flow and user experience.

The application can demonstrate how environmental readings may be collected, transformed into model inputs, scored by a classifier, and communicated as a warning to a user. It can also support controlled demonstrations and usability-oriented observation.

## 2. What the prototype can demonstrate

Within its current software-only scope, the repository can demonstrate:

- A simulated environmental monitoring process.
- Synthetic weather-system precursors and rain-plate events.
- A backend API that provides readings and model predictions.
- Supervised model comparison and probability calibration.
- A warning-state interface with adjustable sensitivity.
- A clothesline visualization and user interaction controls.
- Simulation scenarios for repeatable demonstrations.
- Research-oriented views of model behavior and prediction outcomes.
- Session-level interaction logging for usability activities.

These are capabilities of the software prototype. They should not be confused with proof of performance in a physical deployment.

## 3. What the prototype does not establish

The current repository does not establish:

- Accuracy using measurements from deployed physical sensors.
- Reliability under real household or outdoor operating conditions.
- Forecast skill against independent official weather observations.
- Physical actuation of a clothesline cover or retrieval mechanism.
- Communication with an ESP32, MQTT broker, or real rain/light/environmental sensor hardware.
- Long-term durability, power consumption, or network reliability of a physical device.

A visual control or simulated device state should not be described as a confirmed physical action.

## 4. Interpreting model results

The training and test records are produced by the project's synthetic weather simulator. The model is therefore evaluated on patterns that exist in the simulated environment. The results can help assess whether the ML implementation learns the simulator's designed relationships and whether the warning rule behaves as intended.

They cannot, by themselves, establish that the model will perform similarly on real atmospheric conditions. In particular, the simulator's assumptions, scenario design, and generated distributions influence the measured metrics.

When presenting a metric, identify:

1. Which model produced it.
2. Which dataset split or live simulation window was evaluated.
3. Which metric and threshold were used.
4. Whether the result is row-level or event-level.
5. That the data is synthetic.

Avoid presenting a single metric without its evaluation context.

## 5. Human-computer interaction considerations

The interface communicates status categories, probabilities, sensor information, settings, and alerts. Usability evaluation should consider whether participants can understand the current status, interpret the warning, identify what action is being suggested, and use the controls without confusion.

The frontend includes a facilitator panel and session-event export support. These tools can assist structured demonstrations and collection of interaction observations. Session logs are local to the browser session and should be handled according to the study's consent and data-management procedures.

## 6. Relationship to physical IoT implementation

The repository models an IoT-style flow in software: environmental readings are generated, processed, made available through an API, and presented to a user. A future physical implementation would need actual sensor hardware, a microcontroller, communication and power design, sensor calibration, enclosure considerations, actuator integration where applicable, and testing under real conditions.

Those physical components are not present in the current software repository. Documentation and presentations should make this boundary explicit.

## 7. Responsible wording for reports and demonstrations

Prefer:

- “The simulator generated a rain-like event.”
- “The model estimated a probability of the rain plate becoming wet within 30 minutes.”
- “The warning interface entered the warning state.”
- “The model achieved this metric on the synthetic test sequences.”

Avoid:

- “The system forecast real rainfall accurately” unless supported by independent field evaluation.
- “The sensor detected rain” when describing a software-generated value; say “simulated rain-plate state.”
- “The clothesline automatically closed” when only a visual simulation is shown.
- “The system is IoT-connected” if referring to live physical connectivity in this repository version.

## 8. Future validation needs

A real-world evaluation would require a defined hardware configuration, calibrated sensors, reliable timestamps, a documented collection protocol, independent ground truth for rainfall, and a dataset that is separate from the simulator. The model would then need to be evaluated on those observations using pre-defined metrics and thresholds. HCI evaluation would also need an appropriate participant protocol and documented measures.

These are validation needs, not claims about functionality already delivered by the repository.
