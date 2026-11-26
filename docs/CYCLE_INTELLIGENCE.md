# Phase 06 cycle intelligence

## Recorded history

An observed interval is the number of calendar days between successive saved period starts. Day arithmetic uses ISO calendar dates, including leap days, independently of daylight-saving transitions. Logged starts and explicit date ranges have their own calendar style. An open record marks only its saved start.

The historical median uses valid observed intervals. The recorded period-length median uses explicit start and end dates, including both endpoints. An onboarding start and a one-day legacy record with ambiguous provenance contribute a start only. A legacy one-day entry can be explicitly confirmed by editing it and saving both dates. SQLite migration 2 adds provenance while preserving existing records.

## Next start estimate

The estimator uses the latest seven valid start-to-start intervals, requiring at least three. It adds the rounded median interval to the last saved start. The window spans the observed shortest and longest recent intervals, widened when necessary to provide at least two days of room around the estimate. The window takes calendar days as input and represents an observed planning range. It has no calibrated coverage probability.

The app holds an estimate when dates need review, there is an open record, fewer than three intervals are available, the shortest and longest recent intervals differ by more than 14 days, or the window extends more than 90 days from the last saved start. Once its end has passed without a new entry, the app clears the estimate. The interval count, spread, padding and horizon are product heuristics for this implementation. They carry no clinical interpretation. Configured typical cycle length remains a separate preference.

The application identifies a recorded menstrual day or highlights a date in the estimated start window. Remaining phases stay undetermined from these records. Date-only estimates are unsuitable for contraception, fertility planning or diagnosis. Both primary studies below describe date and ovulation variability. Neither evaluated this estimator.

- Bull et al. (2019), [real-world menstrual cycle characteristics](https://www.nature.com/articles/s41746-019-0152-7).
- Wilcox et al. (2000), [variation in fertile-window timing](https://www.bmj.com/content/321/7271/1259).

## Wellness summaries

The trailing window includes the current day and the preceding 29 days. Mood coverage counts dates, symptom summaries distinguish entries from distinct dates, and energy, stress and sleep averages include recorded valid values only. Notes and journal text are excluded from the analysis. The dashboard does not infer causes, medical conditions, ovulation or the future course of symptoms.
