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
  greater, specified as a byte count as described in
  [`ByteCount`](./2-common-configuration.md#bytecount), or `null` to not rotate
  based on size. Optional, and defaults to `null`.
* `checkPeriod` &mdash; How often to check for a rotation condition, specified
  as a duration value as described in
  [`Duration`](./2-common-configuration.md#duration), or `null` to
  indicate "never check." Optional and defaults to `5 min`. If specified, the
  value must be at least one second (so as to prevent excessive churn). This is
  only meaningful if `atSize` is also specified.
* `maxOldSize` &mdash; How many bytes' worth of old (post-rotation) files
  should be allowed, specified as a byte count as described in
  [`ByteCount`](./2-common-configuration.md#bytecount), or `null` not to have a
  limit. The oldest files over the limit get deleted after a rotation. Optional,
  and defaults to `null`.
* `maxOldCount` &mdash; How many old (post-rotation) files should be allowed, or
  `null` not to have a limit. The oldest files over the limit get deleted after
   a rotation. Optional, and defaults to `null`.
* `onStart` &mdash; If `true`, rotates when the system is first started or
  reloaded (restarted in-process). Optional, and defaults to `false`.
* `onStop` &mdash; If `true`, rotates when the system is about to be stopped or
  reloaded (restarted in-process). Optional, and defaults to `false`.

#### `save`

Relatedly, some services don't ever have a need to do rotation, but they _can_
usefully save files from old runs. In this case, a `save` configuration is
available. This is an object with bindings with the same meanings and defaults
as `rotate`, except that rotation-specific ones are not recognized. These are
the ones that are used by `save`:

* `maxOldSize`
* `maxOldCount`
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
  [`Duration`](./2-common-configuration.md#duration), or `null` to indicate
  "do not buffer." Optional and defaults to `null`.
* `maxUrlLength` &mdash; Maximum length of a URL to log, or `null` to have no
  upper bound. Anything longer than the maximum is represented as a prefix and
  suffix concatenated together with `...` in the middle. Because it makes little
  sense to have a very-small maximum, when non-`null` this must be at least
  `20`.
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

## `ConnectionRateLimiter`

A service which provides rate limiting of network connections, that is,
specifically the act of accepting a connection. (See
[`DataRateLimiter`](#dataratelimiter) for data rate limiting.) Configuration is
exactly as described by [Rate
Limiting](./2-common-configuration.md#rate-limiting), with the token unit
being a connection (class `ConnectionCount`) and the flow rate unit being
connections-per-second (class `ConnectionRate`). The `maxQueueGrant` option
_is not_ allowed (because it is meaningless in this context).

```js
import { ConnectionRateLimiter } from '@lactoserv/webapp-builtins';

const services = [
  {
    name:     'connectionRateLimiter',
    class:    ConnectionRateLimiter,
    maxBurst: '5 conn',
    flowRate: '1 conn per second',
    maxQueue: '15 conn'
  }
];
```

## `DataRateLimiter`

A service which provides data rate limiting of network traffic (specifically
on the write side). Configuration is as described by
[Rate Limiting](./2-common-configuration.md#rate-limiting), with the token unit
being a byte (class `ByteCount`) and the flow rate unit being bytes-per-second
(class `ByteRate`). The `maxQueueGrant` option _is_ allowed. In addition, this
accepts the following configuration bindings:

* `verboseLogging` &mdash; A boolean indicating whether the minutiae of the
  limiter's operations should be logged. If `false`, only major actions
  (including errors) get logged. Default `false`.

```js
import { DataRateLimiter } from '@lactoserv/webapp-builtins';

const services = [
  {
    name:           'dataRateLimiter',
    class:          DataRateLimiter,
    maxBurst:       '5 MiB',
    flowRate:       '32 KiB/sec',
    maxQueue:       '32 MiB',
    maxQueueGrant:  '100 KiB',
    verboseLogging: true
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
  [`Duration`](./2-common-configuration.md#duration). Optional. Minimum `1 sec`
  (which is frankly way too often). Default `5 min` (that is, once every five
  minutes).
* `gracePeriod` &mdash; Once a memory limit has been reached, how long it is
  allowed to remain at or beyond the maximum before this service takes action,
  specified as a duration value as described in
  [`Duration`](./2-common-configuration.md#duration). `0` (or
  `null`) to not have a grace period at all. Default `0`. **Note:** When in the
  middle of a grace period, the service will check memory usage more often than
  `checkPeriod` so as not to miss a significant dip.
* `maxHeap` &mdash; How many bytes of heap is considered "over limit," or `null`
  for no limit on this. Defaults to `null`. If non-`null`, it is expected to be
  a byte count as described in
  [`ByteCount`](./2-common-configuration.md#bytecount). The amount counted is
  `heapTotal + external` from `process.memoryUsage()`. Defaults to `null`.
  **Note:** In order to catch probably-unintentional misconfiguration, if a
  number, must be at least one megabyte.
* `maxRss` &mdash; How many bytes of RSS is considered "over limit," or `null`
  for no limit on this. Defaults to `null`. If non-`null`, it is expected to be
  a byte count as described in
  [`ByteCount`](./2-common-configuration.md#bytecount). **Note:** In order to
  catch probably-unintentional misconfiguration, if non-`null`, must be at least
  one megabyte.

```js
import { MemoryMonitor } from '@lactoserv/webapp-builtins';

const services = [
  {
    name:        'memory',
    class:       MemoryMonitor,
    checkPeriod: '5 min',
    gracePeriod: '1 min',
    maxHeap:     '100 MiB',
    maxRss:      '150 MiB'
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
  [`Duration`](./2-common-configuration.md#duration), or `null` to
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
  [`Duration`](./2-common-configuration.md#duration), or `null` to indicate
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

## `SyslogToFile`

A service which writes system activity logis either in a human-friendly or JSON
form, to a (filesystem) file. It accepts the following configuration bindings:

* `bufferPeriod` &mdash; Duration indicating how long to buffer up log entries
  before writing them to the file, specified as a duration value as described in
  [`Duration`](./2-common-configuration.md#duration), or `null` to indicate
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
Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
