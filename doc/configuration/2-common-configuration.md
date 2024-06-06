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

## Real-World Units

Several configurations are specified as real-world units, including for example
time durations and data quantities. Each type of unit has a corresponding class,
and can be specified in a configuration file using that class directly or by
providing a string that can be parsed into an instance of that class. The
classes are all in either the `data-values` or `webapp-util` module.

When using a string, the accepted syntax is a number in the usual JavaScript
form (including exponents and internal underscores), followed by the unit
name(s). The number and unit name are allowed to be separated by a single space
or underscore, as is the slash (`/`) between numerator and denominator units.
The slash can be replaced with the word `per` (which _must_ be separated from
the units with a space or underscore).

Examples:

* `1 day`
* `1_000ms`
* `123_per_sec`
* `5/hour`
* `120 GiB per day`

### `ByteCount`

Amounts of data are specified using the class `ByteCount`. The available units
are:

* `byte` or `B` &mdash; Bytes.
* `kB`, `MB`, `GB`, or `TB` &mdash; Standard decimal powers-of-1000 bytes.
* `KiB`, `MiB`, `GiB`, or `TiB` &mdash; Standard binary powers-of-1024 bytes.

```js
import { ByteCount } from '@lactoserv/data-values';
```

### `ByteRate`

Rates of data flow are specified using the class `ByteRate`. The available units
are the same as with `ByteCount` for the numerator and the same as with
`Frequency` for the denominator (except that `hertz` / `Hz` isn't allowed).

```js
import { ByteRate } from '@lactoserv/data-values';
```

### `ConnectionCount` and `ConnectionRate`

Counts and rates of network connections are covered by the classes
`ConnectionCount` and `ConnectionRate`. The numerator units &mdash;
`connection`, `conn`, and `c` &mdash; are all equivalent and represent a single
connection. Denominator units are the same as with `Frequency`.

```js
import { ConnectionCount, ConnectionRate } from '@lactoserv/webapp-util';
```

### `Duration`

Durations are specified using the class `Duration`. The available units are:

* `nsec` or `ns` &mdash; Nanoseconds.
* `usec` or `us` &mdash; Microseconds.
* `msec` or `ms` &mdash; Milliseconds.
* `second` or `sec` or `s` &mdash; Seconds.
* `minute` or `min` or `m` &mdash; Minutes.
* `hour` or `hr` or `h` &mdash; Hours.
* `day` or `d` &mdash; Days, where a "day" is defined to be exactly 24 hours.

```js
import { Duration } from '@lactoserv/data-values';
```

### `Frequency`

Frequencies are specified using the class `Frequency`. The available units are:

* `/nsec` or `/ns` &mdash; Per nanosecond.
* `/usec` or `/us` &mdash; Per microsecond.
* `/msec` or `/ms` &mdash; Per millisecond.
* `/second` or `/sec` or `/s` &mdash; Per second.
* `/minute` or `/min` or `/m` &mdash; Per minute.
* `/hour` or `/hr` or `/h` &mdash; Per hour.
* `/day` or `/d` &mdash; Per (24-hour) day.

As a rarely-useful addition, the _numerator_ unit `hertz` or `Hz` is allowed as
an equivalent to `/sec`.

```js
import { Frequency } from '@lactoserv/data-values';
```

### `RequestCount` and `RequestRate`

Counts and rates of network requests are covered by the classes `RequestCount`
and `RequestRate`. The numerator units &mdash; `request`, `req`, and `r` &mdash;
are all equivalent and represent a single request. Denominator units are the
same as with `Frequency`.

```js
import { RequestCount, RequestRate } from '@lactoserv/webapp-util';
```

## Rate Limiting

A handful of applications and services have rate-limiting functionality. Rate
limiting is modeled as a hybrid-model "leaky token bucket," where a non-empty
bucket causes immediate flow (of data, etc.), and an empty bucket causes the
system to allow flow at a defined rate.

These applications and services all accept a common set of configuration
options. In each specific case, there is a "token unit" and a "flow rate unit."
These units are always each a real-world unit of some sort (as described above).

* `flowRate` &mdash; The rate of token flow once any burst capacity is
  exhausted, _and_ the rate at which burst capacity is built up. The rate must
  be positive.
* `initialBurst` &mdash; Optional starting amount of available token "burst"
  before rate limiting takes effect. Minimum value `0`, and must be no larger
  than `maxBurst`. Defaults to `maxBurst`.
* `maxBurst` &mdash; The maximum number of tokens that can be built up for a
  "burst" before rate limiting takes effect. Minimum value `1`.
* `maxQueue` &mdash; Optional maximum possible size of the wait queue, in
  tokens, or `null` for no limit. Minimum value `1`. This is the number of
  tokens that are allowed to be queued up for a grant, when there is
  insufficient burst capacity to satisfy all active clients. Attempts to queue
  up more requests will result in token denials (e.g., network connections
  closed instead of sending bytes). Defaults to `null`.
* `maxQueueGrant` &mdash; Optional maximum possible size of a grant given to
  a requester in the wait queue, in tokens. Minimum value `1`. If not
  specified, it is the same as the `maxBurst`. **Note:** This configuration is
  only used by _some_ rate limiters.

```js
import { SomeSortOfRateLimiter } from '@lactoserv/webapp-builtins';

const services = [
  {
    name:          'limiter',
    class:         SomeSortOfRateLimiter,
    initialBurst:  '1 MiB',
    maxBurst:      '5 MiB',
    flowRate:      '32 KiB/sec',
    maxQueue:      '32 MiB',
    maxQueueGrant: '100 KiB'
  }
];
```

This diagram might help understand the various configuration options:

![Rate Limiting Diagram](./rate-limiting.png?raw=true "Rate Limiting Diagram")

## Logging

Endpoints, applications, and services all offer the option to log their dispatch
processes in detail. This is turned off by default. To turn it on, use the
configuration option `dispatchLogging: true`.

Turning on this option causes dispatch logging to be initiated at the item in
question, but it won't turn _off_ logging if initiated earlier in the dispatch.
For example, if an application has dispatch logging turned off, but the endpoint
which dispatched to it has it on, then the application _will_ perform dispatch
logging.

```js
const applications = [
  {
    name:            'chattyAppy',
    class:           ChattyAppy,
    dispatchLogging: true,
    // ... more ...
  }
];
```

- - - - - - - - - -
```
Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
