Configuration Guide: Common Configuration
=========================================

This chapter documents commonly-used configuration properties and syntax, used
for more than one type of component (e.g., both services and applications).

## File Names

Several components accept file paths as configured properties, which are
typically required to be absolute paths. In _some_ cases, the final name
component of the path is treated as a prefix + suffix combination, where the
prefix is everything before a final dot (`.`), and the suffix is the final dot
and everything that follows. (For example, `some.file.txt` would be parsed as
prefix `some.file` and suffix `.txt`.) These parsed names are used to construct
_actual_ file names by inserting something in between the prefix and suffix
(such as a date stamp and/or a sequence number), or in some cases just used
as-is.

## Specifying durations and frequencies/rates

Several configurations are specified as either time durations or
frequencies/rates. These can be specified as instances of the utility classes
`data-values.Duration` and `data-values.Frequency` (respectively), or they can
be specified as unit quantity strings, which include a number and a unit name,
e.g. durations `1 day` or `1_000ms`, or frequencies `123 per sec` or `5/day`.

For the string form, the numeric portion is allowed to be any usual-format
floating point number, including exponents, and including internal underscores
for readability. The number and unit can be separated with either a space or an
underscore, or they can just be directly next to each other. The frequency units
can be indicated either with a leading slash (e.g., `5 / min`) or with the word
`per` (e.g. `72 per hr`).

### Durations

The available units for durations are:

* `nsec` or `ns` &mdash; Nanoseconds.
* `usec` or `us` &mdash; Microseconds.
* `msec` or `ms` &mdash; Milliseconds.
* `second` or `sec` or `s` &mdash; Seconds.
* `minute` or `min` or `m` &mdash; Minutes.
* `hour` or `hr` or `h` &mdash; Hours.
* `day` or `d` &mdash; Days, where a "day" is defined to be exactly 24 hours.

### Frequencies

The available units for frequencies are:

* `/nsec` or `/ns` &mdash; Per nanosecond.
* `/usec` or `/us` &mdash; Per microsecond.
* `/msec` or `/ms` &mdash; Per millisecond.
* `/second` or `/sec` or `/s` &mdash; Per second.
* `/minute` or `/min` or `/m` &mdash; Per minute.
* `/hour` or `/hr` or `/h` &mdash; Per hour.
* `/day` or `/d` &mdash; Per (24-hour) day.

- - - - - - - - - -
```
Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
