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

## Specifying real-world units.

Several configurations are specified as real-world units, including for example
time durations and data quantities. Each type of unit has a corresponding class,
and can be specified in a configuration file using that class directly or by
providing a string that can be parsed into an instance of that class. The
classes are all in the `data-values` module.

When using a string, the accepted syntax is a number in the usual JavaScript
form (including exponents and internal underscores), followed by the unit
name(s). The number and unit name are allowed to be separated by a single space
or underscore, as is the slash (`/`) between numerator and denominator units.
The slash can be replaced with the word `per` (which _must_ be separated from
the units with a space or underscore).

Examples:

* `1 day`
* `1_000ms`
* `123 per sec`
* `5/day`

### `ByteCount`

Amounts of data are specified using the class `ByteCount`. The available units
are:

* `byte` or `B` &mdash; Bytes.
* `kB`, `MB`, `GB`, or `TB` &mdash; Standard decimal powers-of-1000 bytes.
* `KiB`, `MiB`, `GiB`, or `TiB` &mdash; Standard binary powers-of-1024 bytes.

### `ByteRate`

Rates of data flow are specified using the class `ByteRate`. The available units
are the same as with `ByteCount` for the numerator and the same as with
`Frequency` for the denominator (except that `hertz` / `hz` isn't allowed). For
example, `25 GiB / day`.

### `Duration`

Durations are specified using the class `Duration`. The available units are:

* `nsec` or `ns` &mdash; Nanoseconds.
* `usec` or `us` &mdash; Microseconds.
* `msec` or `ms` &mdash; Milliseconds.
* `second` or `sec` or `s` &mdash; Seconds.
* `minute` or `min` or `m` &mdash; Minutes.
* `hour` or `hr` or `h` &mdash; Hours.
* `day` or `d` &mdash; Days, where a "day" is defined to be exactly 24 hours.

### `Frequency`

Frequencies are specified using the class `Frequency`. The available units are:

* `/nsec` or `/ns` &mdash; Per nanosecond.
* `/usec` or `/us` &mdash; Per microsecond.
* `/msec` or `/ms` &mdash; Per millisecond.
* `/second` or `/sec` or `/s` &mdash; Per second.
* `/minute` or `/min` or `/m` &mdash; Per minute.
* `/hour` or `/hr` or `/h` &mdash; Per hour.
* `/day` or `/d` &mdash; Per (24-hour) day.

As a rarely-useful addition, the _numerator_ unit `hertz` or `hz` is allowed as
an equivalent to `/sec`.

- - - - - - - - - -
```
Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
