Configuration Guide: Built-In Services
======================================

## Common Service Configuration

This section documents a handful of common properties and sub-objects that are
used when configuring services. The documentation for services that use these
indicate which (if any) apply.

See also [Common Configuration](./2-common-configuration.md) for configuration
details that apply to more than just services.

### File Rotation And Preservation

#### `rotate`

Some services accept `rotate` as a configured property, which enables automatic
file rotation and cleanup. A `rotate` configuration is an object with the
following bindings:

* `atSize` &mdash; Rotate when the file becomes the given size (in bytes) or
  greater. Optional, and if not specified (or if `null`), does not rotate based
  on size.
* `checkPeriod` &mdash; How often to check for a rotation condition, specified
  as a duration value as described in
  [Durations](./2-common-configuration.md#durations), or `null` to
  indicate "never check." Optional and defaults to `5 min`. If specified, the
  value must be at least one second (so as to prevent excessive churn). This is
  only meaningful if `atSize` is also specified.
* `maxOldBytes` &mdash; How many bytes' worth of old (post-rotation) files
  should be allowed, or `null` not to have a limit. The oldest files over the
  limit get deleted after a rotation. Optional, and defaults to `null`.
* `maxOldCount` &mdash; How many old (post-rotation) files should be allowed, or
  `null` not to have a limit. The oldest files over the limit get deleted after
   a rotation. Optional, and defaults to `null`.
* `onReload` &mdash; If `true`, rotates when the system is reloaded (restarted
  in-process). Optional, and defaults to `false`.
* `onStart` &mdash; If `true`, rotates when the system is first started.
  Optional, and defaults to `false`.
* `onStop` &mdash; If `true`, rotates when the system is about to be stopped.
  Optional, and defaults to `false`.

#### `save`

Relatedly, some services don't ever have a need to do rotation, but they _can_
usefully save files from old runs. In this case, a `save` configuration is
available. This is an object with bindings with the same meanings and defaults
as `rotate`, except that rotation-specific ones are not recognized. These are
the ones that are used by `save`:

* `maxOldBytes`
* `maxOldCount`
* `onReload`
* `onStart`
* `onStop`

Note that at least one of the `on*` bindings need to be provided for a `save` to
have any meaning.

## `AccessLogToFile`

A service which logs information about HTTP-ish requests in a textual form
meant to be similar to (though not identical to) what is commonly produced by
other webservers (out in the world). As of this writing, the exact format is
_not_ configurable. It accepts the following configuration bindings:

* `bufferPeriod` &mdash; Duration indicating how long to buffer up log entries
  before writing them to the file, specified as a duration value as described in
  [Durations](./2-common-configuration.md#durations), or `null` to indicate
  "do not buffer." Optional and defaults to `null`.
* `path` &mdash; Path to the log file(s) to write. When rotation is performed, a
  date stamp and (if necessary) sequence number are "infixed" into the final
  path component.
* `rotate` &mdash; Optional file rotation configuration. If not specified, no
  file rotation is done. See "File Rotation and Preservation" below for
  configuration details.

```js
import { AccessLogToFile } from '@lactoserv/webapp-builtins';

const services = [
  {
    name:         'accessLog',
    class:        AccessLogToFile,
    path:         '/path/to/var/log/access-log.txt',
    bufferPeriod: '0.25 sec',
    rotate: { /* ... */ }
  }
];
```

## `AccessLogToSyslog`

A service which logs very detailed information about HTTP-ish requests to the
_system_ log. Such logging in turn goes to wherever the system log goes (e.g.,
into a file). It does not accept any configuration bindings beyond the basics
of any service.

```js
import { AccessLogToSyslog } from '@lactoserv/webapp-builtins';

const services = [
  {
    name:  'accessSyslog',
    class: AccessLogToSyslog
  }
];
```

## `EventFan`

A service which "fans out" any events it receives to a set of other services, in
parallel. It accepts the following configuration bindings:

* `services` &mdash; An array listing the _names_ of other services as values.

An instance of this service can be used, for example, to get two different
network request loggers to be attached to a single network endpoint. (This is
done in the example configuration file, for reference.)

```js
import { EventFan } from '@lactoserv/webapp-builtins';

const services = [
  {
    name:     'myFan',
    class:    EventFan,
    services: ['goHere', 'goThere']
  },
  {
    name: 'goHere',
    // ... more ...
  },
  {
    name: 'goThere',
    // ... more ...
  }
];
```

## `MemoryMonitor`

A service which occasionally checks the system's memory usage, and will force a
(hopefully) clean shutdown if memory usage is too high, with an optional grace
period to allow momentary usage spikes. It accepts the following configuration
bindings:

* `checkPeriod` &mdash; How often to check for memory usage being over the
  defined limit, specified as a duration value as described in
  [Durations](./2-common-configuration.md#durations). Optional. Minimum `1 sec`
  (which is frankly way too often). Default `5 min` (that is, once every five
  minutes).
* `gracePeriod` &mdash; Once a memory limit has been reached, how long it is
  allowed to remain at or beyond the maximum before this service takes action,
  specified as a duration value as described in
  [Durations](./2-common-configuration.md#durations). `0` (or
  `null`) to not have a grace period at all. Default `0`. **Note:**: When in the
  middle of a grace period, the service will check memory usage more often than
  `checkPeriod` so as not to miss a significant dip.
* `maxHeapBytes` &mdash; How many bytes of heap is considered "over limit," or
  `null` for no limit on this. The amount counted is `heapTotal + external` from
  `process.memoryUsage()`. Defaults to `null`. **Note:** In order to catch
  probably-unintentional misconfiguration, if a number, must be at least one
  megabyte.
* `maxRssBytes` &mdash; How many bytes of RSS is considered "over limit," or
  `null` for no limit on this. Defaults to `null`. **Note:** In order to catch
  probably-unintentional misconfiguration, if non-`null`, must be at least one
  megabyte.

```js
import { MemoryMonitor } from '@lactoserv/webapp-builtins';

const services = [
  {
    name:         'memory',
    class:        MemoryMonitor,
    checkPeriod:  '5 min',
    gracePeriod:  '1 min',
    maxHeapBytes: 100 * 1024 * 1024,
    maxRssBytes:  150 * 1024 * 1024
  }
];
```

## `ProcessIdFile`

A service which writes a simple text file containing the process ID (number) of
the running system, and which optionally tries to deal with other simultaneous
processes that also write to the same file. The file is written when the system
starts up, when it shuts down (if not killed with extreme prejudice), and
optionally on a periodic basis. It accepts the following configuration bindings:

* `path` &mdash; Path to the file. Must be an absolute path.
* `multiprocess` &mdash; Deal with multiple processes writing to the file?
  Optional and defaults to `false`. If `true`, whenever the file is written, it
  is read first and any process IDs found in it are kept if they are in fact
  still running.
* `updatePeriod` &mdash; How long to wait between each file update, specified as
  a duration value as described in
  [Durations](./2-common-configuration.md#durations), or `null` to
  indicate "never." Optional and defaults to `null`. If specified, the value
  must be at least one second (so as to prevent excessive churn). This value is
  only meaningfully used when `multiprocess` is `true`.

```js
import { ProcessIdFile } from '@lactoserv/webapp-builtins';

const services = [
  {
    name:         'process-id',
    class:        ProcessIdFile,
    path:         '/path/to/var/run/process.txt',
    multiprocess: true,
    updatePeriod: '1 hr'
  }
];
```

## `ProcessInfoFile`

A service which writes out a JSON-format file containing information about the
running system. The file name includes the process ID; and the file is written
when the system starts up, when it shuts down (if not killed with extreme
prejudice), and optionally on a periodic basis. It accepts the following
configuration bindings:

* `path` &mdash; Path to the file, with the final path component modified by
  infixing the process ID.
* `updatePeriod` &mdash; How long to wait between each file update while the
  system is running, specified as a duration value as described in
  [Durations](./2-common-configuration.md#durations), or `null` to indicate
  "never." Optional and defaults
  to `null`. If specified, the value must be at least one second (so as to
  prevent excessive churn).
* `save` &mdash; Optional file preservation configuration. If not specified, no
  file preservation is done.

```js
import { ProcessInfoFile } from '@lactoserv/webapp-builtins';

const services = [
  {
    name:         'process',
    class:        ProcessInfoFile,
    path:         '/path/to/var/run/process.json',
    updatePeriod: '5 min',
    save:         { /* ... */ }
  }
];
```

**Note:** If file preservation (`save`) is being done, then any time an old file
is preserved, it is first checked to see if it has a shutdown "disposition"
(that is, an indication that the system had a chance to note why it was
stopped). If not, the system will update that file to indicate "unexpected
shutdown."

## `RateLimiter`

A service which provides rate limiting of any/all of network connections,
HTTP-ish requests, or sent data. Rate limiting is modeled as a hybrid-model
"leaky token bucket." The configuration consists of three sections, each
optional, for `connections` (token unit, a connection), `requests` (token unit,
a request), and `data` (token unit, a byte). Each of these is configured as an
object with the following bindings:

* `flowRate` &mdash; The rate of token flow once any burst capacity is
  exhausted, specified as a frequency value as described in
  [Frequencies](./2-common-configuration.md#frequencies).
* `maxBurstSize` &mdash; The maximum allowed "burst" of tokens before
  rate-limiting takes effect.
* `maxQueueSize` &mdash; Optional maximum possible size of the wait queue, in
  tokens. This is the number of tokens that are allowed to be queued up for a
  grant, when there is insufficient burst capacity to satisfy all active
  clients. Attempts to queue up more result in token denials (e.g. network
  connections closed instead of sending bytes).
* `maxQueueGrantSize` &mdash; Optional maximum possible size of a grant given to
  a requester in the wait queue, in tokens. If not specified, it is the same as
  the `maxBurstSize`. (It is really only meaningful for `data` limiting, because
  `connections` and `requests` are only requested one at a time.)

```js
import { RateLimiter } from '@lactoserv/webapp-builtins';

const services = [
  {
    name:  'limiter',
    class: RateLimiter,
    connections: {
      maxBurstSize: 5,
      flowRate:     '1 per second',
      maxQueueSize: 15
    },
    requests: { /* ... */ },
    data: { /* ... */ }
  }
];
```

## `SyslogToFile`

A service which writes system activity logis either in a human-friendly or JSON
form, to a (filesystem) file. It accepts the following configuration bindings:

* `bufferPeriod` &mdash; Duration indicating how long to buffer up log entries
  before writing them to the file, specified as a duration value as described in
  [Durations](./2-common-configuration.md#durations), or `null` to indicate
  "never check." Optional and defaults to `null`.
* `format` &mdash; Either `human` or `json`.
* `path` &mdash; Path to the log file(s) to write. When rotation is performed, a
  date stamp and (if necessary) sequence number are "infixed" into the final
  path component.
* `rotate` &mdash; Optional file rotation configuration. If not specified, no
  file rotation is done. See "File Rotation and Preservation" below for
  configuration details.

**Note:** As of this writing, the system tends to be _very_ chatty, and as such
the system logs can be quite massive. If you choose to use this service, it is
highly advisable to set up sane limits on the amount of storage used by
configuring `rotate`.

```js
import { SyslogToFile } from '@lactoserv/webapp-builtins';

const services = [
  {
    name:   'syslog-json',
    class:  SyslogToFile,
    path:   '/path/to/var/log/system-log.json',
    format: 'json',
    rotate: { /* ... */ }
  }
];
```

- - - - - - - - - -
```
Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
