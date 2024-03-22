Configuration Guide
===================

Lactoserv is configured with a JavaScript source file (notably, as opposed to a
JSON file). This tactic is meant to remove the need for "halfhearted
programming" facilities baked into a system configuration parser itself. A
configuration file is expected to be a module (`.mjs` or `.cjs`) which has a
single `default` export consisting of a JavaScript object of the ultimate
configuration. Very skeletally (and reductively):

```js
const config = {
  // ... configuration ...
};

export default config;
```

**Note:** Please refer to the
[example configuration file](../etc/example-setup/config/config.mjs)
for reference: First, while this guide is intended to be accurate, the example
configuration is actually tested regularly. Second, the example uses some of the
tactics which are mentioned here, so you can see them "in action."

## `import`s

All core Node libraries are available for `import` in a configuration file,
but they _must_ be imported using the `node:` prefix form (not just plain
names), e.g.:

```js
import { readFile } from 'node:fs/promises';
```

In addition, all of Lactoserv's framework classes are available for import,
using the module namespace prefix `@lactoserv/`, e.g.:

```js
import { Moment } from '@lactoserv/data-values';
```

And in order to use any of the built-in applications or services, you will need
to import them from `@lactoserv/built-ins`.

## Configuration object bindings

The following are the bindings that are expected at the top level of the
exported configuration object. In each case, the binding is described as a
"list" and is typically a JavaScript array. However, in cases where only one
element is needed, a plain object may be bound directly instead of being a
one-element array.

### `hosts`

`hosts` is a list of hostname bindings. These map possibly-wildcarded hostnames
to certificate-key pairs to use to authenticate an endpoint as those hosts. Each
entry has the following bindings:

* `hostnames` &mdash; A list of one or more hostnames to recognize; this is
   required. Hostnames are allowed to start with a `*` to indicate a wildcard of
   _any number of subdomains, including zero._ Note that this is unlike how
   wildcards work in the underlying certificates, where a `*` denotes exactly
   one subdomain. And, to be clear, the hostname `*` will match _any_ hostname
   at all, with any number of subdomains.
* `certificate` &mdash; PEM format string containing the certificate to use for
  this entry. This is required if `selfSigned` is absent or `false`.
* `privateKey` &mdash; PEM format string containing the private key to use for
  this entry. This is required if `selfSigned` is absent or `false`.
* `selfSigned` &mdash; Optional boolean, which, if `true`, causes the system to
  generate a self-signed certificate for this entry. This is mostly useful in
  testing scenarios, and more specifically when running a server on your
  development machine, e.g. and commonly responding on `localhost`.

```js
const hosts = [
  {
    hostnames:  ['localhost', '*'],
    selfSigned: true
  },
  {
    hostnames:   ['*.example.com'],
    certificate: '-----BEGIN CERTIFICATE-----...',
    privateKey:  '-----BEGIN PRIVATE KEY-----...'
  },
  // ... more ...
];
```

This section is only required if at least one endpoint is to respond to
host-authenticated protocols (which is nearly always, at least in standalone
uses).

**Note:** If you want to keep the text of the keys and certificates out of the
main configuration file, then a reasonablhy easy tactic is to use the standard
Node `fs` package to read the contents of files named in the configuration.

### `services`

`services` is a list of system services to be used, with each element naming and
configuring one of them. A system service is simply an encapsulated bit of
functionality that gets hooked up to the system in general or to some other more
specific part of the system (typically, to one or more network endpoints).

There are two required bindings for each system service, its `name` and its
`class` (type). Beyond that, the configuration depends on the `class`. See below
for a list of all built-in system services. The `name` is used both when logging
activity (to the system log) and when hooking services up.

```js
import { ServiceClass } from '@lactoserv/built-ins';

const services = [
  {
    name:       'someService',
    class:      ServiceClass,
    // ... class-specific configuration ...
  },
  // ... more ...
```

This section is only required if there are any services being defined at all.

### `applications`

`applications` is a list of applications to be used, with each element naming
and configuring one of them. An application is an encapsulated bit of
functionality which specifically knows how to respond to external (HTTP-ish)
requests.

As with services, there are two required bindings for each application, its
`name` and its `class` (type). Beyond that, the configuration depends on the
`class`. See below for a list of all built-in applications. The `name` is used
both when logging activity (to the system log) and when hooking applications up
to endpoints.

```js
import { ApplicationClass } from '@lactoserv/built-ins';

const applications = [
  {
    name:       'someApplication',
    class:      ApplicationClass,
    // ... class-specific configuration ...
  },
  // ... more ...
```

### `endpoints`

`endpoints` is a list of network endpoints to listen on, with each element
naming and configuring one of them. Each element has the following bindings:

* `name` &mdash; The name of the endpoint. This is just used for logging and
  related informational purposes.
* `hostnames` &mdash; A list of one or more hostnames to recognize, each name
  in the same form as accepted in the `hosts` section of the configuration. In
  most cases, it will suffice to just specify this as `['*']`.
* `interface` &mdash; The network interface to listen on. This is a string which
  can take one of two forms:
  * `<address>:<port>` &mdash; Specifies a normal network-attached interface.
    `<address>` is a DNS name, an IPv4 address, a _bracketed_ IPv6 address, or
    the wildcard value `*`. `<port>` is a non-zero (decimal) port number.
    **Note:** It is invalid to use the IP-version-specific "any" identifiers
    `::` or `0.0.0.0` (or similar).
  * `/dev/fd/<fd-num>` &mdash; Specifies a file descriptor which is expected to
    already correspond to an open server socket (e.g. set up by `systemd`).
    `<fd-num>` is an arbitrary (decimal) number in the range of valid file
    descriptors.
* `protocol` &mdash; The protocol to speak. This can be any of `http`, `https`,
  or `http2`. `http2` includes fallback to `https`.
* `services` &mdash; An object which binds roles to system services by name.
  This binding is optional, and if present all roles are optional. The following
  roles are recognized:
  * `rateLimiter` &mdash; A request/data rate limiter.
  * `requestLogger` &mdash; A request logger.
* `application`: &mdash; The name of the application which this endpoint should
  send requests to. **Note:** In order to serve multiple leaf applications, the
  one named here will have to be a routing application of some sort (such as
  [`PathRouter`](#pathrouter), for example).

```js
const endpoints = [
  {
    name: 'someEndpoint',
    endpoint: {
      hostnames: ['*'],
      interface: '*:8443',
      protocol:  'http2'
    },
    services: {
      rateLimiter:   'limiter',
      requestLogger: 'requests'
    },
    application: 'mySite'
  },
```

**A note about application mounts:** When finding an application to dispatch a
request to, the system will pick the most-specific matching hostname from the
mounts, and then within that hostname will pick the most-specific matching path.
It then asks the so-identified application to handle the request. If the
application chooses not to handle it, then the system will pick the next most
specific path, and so on, until there are no more options within the selected
hostname. (It will not fall back to less specific hostnames.)

## Built-in Applications

### `BaseApplication`

`BaseApplication` can be subclassed to implement custom behavior. In addition,
it optionally provides request filtering for application subclasses in general,
including the built-in applications. It accepts the following configuration
bindings:

* `acceptMethods` &mdash; Array of strings indicating which request methods to
  accept. The array can include any of `connect`, `delete`, `get`, `head`,
  `options`, `patch`, `post`, `put`, and/or `trace`. Defaults to the entire set.
* `maxPathLength` &mdash; Number indicating the maximum (inclusive) allowed
  length _in path components_ of a dispatched request path not including the
  mount point, and not including the empty path component at the end of a
  directory path. `null` indicates "no limit." Defaults to `null`.
* `maxQueryLength` &mdash; Number indicating the maximum (inclusive) allowed
  length of the query (a/k/a "search") portion of a request URI _in octets_,
  including the leading question mark (`?`). `null` indicates "no limit." `0`
  indicates that queries are not ever accepted. Defaults to `null`.
* `redirectDirectories` &mdash; Boolean indicating whether or not directory
  paths (those ending with an empty path component) should be automatically
  redirected to the file (non-directory) version of the path. Defaults to
  `false`.
* `redirectFiles` &mdash; Boolean indicating whether or not file paths (those
  not ending with an empty path component) should be automatically redirected to
  the directory version of the path. Defaults to `false`.

With regards to the `redirect*` options:
* It is an error to specify both as `true`.
* The redirection (or not) is entirely based on the form of the path, not on any
  file contents (for example). Notably, [`StaticFiles`](#staticfiles) does
  _content_-driven redirection, which is different than what is done here.

With regards to the other options, when a request is filtered out, the result is
that the application simply _doesn't handle_ the request, meaning that the
request will get re-dispatched to the next application in the chain (if any).

```js
import { BaseApplication } from '@lactoserv/sys-framework';

class MyApplication extends BaseApplication {
  // ... more ...
}

const applications = [
  {
    name:           'myCustomApp',
    class:          MyApplication,
    acceptMethods:  ['delete', 'put'],
    maxQueryLength: 0
  }
];
```

### `HostRouter`

An application which can route requests to another application, based on the
`host` (or equivalent) header in the requests. In addition to the
[`BaseApplication`](#baseapplication) configuration options, it accepts the
following bindings:

* `hosts` &mdash; A plain object with possibly-wildcarded hostnames as keys, and
  the _names_ of other applications as values. A wildcard only covers the prefix
  of a hostname and cannot be used for hostnames identified by numeric IP
  address.

**Note:** Unlike `PathRouter`, this application does not do fallback to
less-and-less specific routes; it just finds (at most) one to route to.

```js
import { HostRouter } from '@lactoserv/built-ins';

const applications = [
  {
    name:  'myHosts',
    class: HostRouter,
    hosts: {
      '*':             'myCatchAllApp',
      '127.0.0.1':     'myLocalhostApp',
      'localhost':     'myLocalhostApp',
      '*.example.com': 'myExampleApp'
    }
  },
  {
    name: 'myCatchallApp',
    // ... more ...
  },
  {
    name: 'myExampleApp',
    // ... more ...
  },
  {
    name: 'myLocalhostApp',
    // ... more ...
  }
];
```

### `PathRouter`

An application which can route requests to another application, based on the
path of the requests. In addition to the [`BaseApplication`](#baseapplication)
configuration options, it accepts the following bindings:

* `paths` &mdash; A plain object with possibly-wildcarded paths as keys, and
  the _names_ of other applications as values. A wildcard only covers the suffix
  of a path; it cannot be used for prefixes or infixes.

The routing works by starting with the most specific match to the path of an
incoming request. If that app does not try to handle the request &mdash;
note that it counts as a "try" to end up `throw`ing out of the handler &mdash;
the next most specific match is asked, and so on, until there are no path
matches left.

```js
import { HostRouter } from '@lactoserv/built-ins';

const applications = [
  {
    name:  'myHosts',
    class: HostRouter,
    hosts: {
      '*':             'myCatchAllApp',
      '127.0.0.1':     'myLocalhostApp',
      'localhost':     'myLocalhostApp',
      '*.example.com': 'myExampleApp'
    }
  },
  {
    name: 'myCatchallApp',
    // ... more ...
  },
  {
    name: 'myExampleApp',
    // ... more ...
  },
  {
    name: 'myLocalhostApp',
    // ... more ...
  }
];
```

### `Redirector`

An application which responds to all requests with an HTTP "redirect" response.
In addition to the [`BaseApplication`](#baseapplication) configuration options,
it accepts the following bindings:

* `acceptMethods` &mdash; `BaseApplication` configuration, but in this case the
  default is `['delete', 'get', 'head', 'patch', 'post', 'put']`.
* `statusCode` &mdash; Optional HTTP status code to respond with. If not
  specified, it defaults to `301` ("Moved Permanently").
* `target` &mdash; The base URL to redirect to. This is prepended to the partial
  path of each request to form the final redirection URL.
* `cacheControl` &mdash; `cache-control` header definition. If present and not
  `false`, every cacheable response comes with the specified header.

```js
import { Redirector } from '@lactoserv/built-ins';

const applications = [
  {
    name:          'myRedirector',
    class:         Redirector,
    statusCode:    308,
    target:        'https://example.com/boop/',
    cacheControl:  { public: true, maxAge: '5 min' },
    acceptMethods: ['head', 'get']
  }
];
```

### `SimpleResponse`

An application which only ever sends one particular response. It's approximately
like `StaticFiles`, except just one file. In addition to the
[`BaseApplication`](#baseapplication) configuration options, it accepts the
following configuration bindings:

* `acceptMethods` &mdash; `BaseApplication` configuration, but in this case the
  default is `['get', 'head']`.
* `body` &mdash; Optional body contents to respond with. If specified, this must
  be either a string or a Node `Buffer` object.
* `contentType` &mdash; Content type to report. This can be either a MIME type
  per se (e.g. `text/plain`) or a commonly-understood extension (with leading
  dot, e.g., `.txt` or `.html`). This must be specified if `body` is. If this is
  not specified but `filePath` is, then the type is inferred from the extension
  on the path. If neither `body` nor `filePath` is specified (that is, for an
  empty body), then this must not be specified either. In the MIME type form,
  an explicit `charset` is honored (e.g. `text/plain; charset=iso-8859-1`), but
  if not specified then `utf-8` is assumed for text types.
* `cacheControl` &mdash; `cache-control` header definition. If present and not
  `false`, every cacheable response comes with the specified header.
* `etag` &mdash; ETag-generating options. If present and not `false`, the
  response comes with an `ETag` header. See "ETag Configuration" below for
  details.
* `filePath` &mdash; Optional absolute filesystem path to the file to respond
  with.
* `statusCode` &mdash; Optional fixed status code to report. If present and not
  `null`, this is the numeric status code that will be used for all responses.
  Setting this also prevents range requests and not-modified responses from
  being generated.

It is valid to specify neither `body` nor `filePath`; this indicates that the
application should only ever produce no-content (status `204`) responses. It is
_not_ valid to specify _both_ `body` and `filePath`.

**Note:** Passing `body` as an empty string or `Buffer` is treated as
zero-length but contentful, e.g. a regular successful response will be status
`200` with `Content-Length: 0`. Likewise, this is how an empty file pointed at
by a `filePath` behaves.

```js
import { SimpleResponse } from '@lactoserv/built-ins';

const applications = [
  {
    name:                'literal',
    class:               SimpleResponse,
    contentType:         'text/plain',
    body:                'Hello!\n',
    cacheControl:        { public: true, maxAge: '1_day' },
    maxPathLength:       0,
    redirectDirectories: true,
  },
  {
    name:         'fromFile',
    class:        'SimpleResponse',
    filePath:     '/etc/site/notFoundMessage.txt',
    cacheControl: 'immutable; max-age=1000',
    statusCode:   404
  },
  {
    name:  'empty',
    class: 'SimpleResponse'
  }
];
```

There are a few notable things which _aren't_ configurable for this application.
These may be configurable in a future version, if there is sufficient and
reasonable demand:

* Content types:
  * The mapping from extensions to MIME types is not configurable.
* Caching:
  * The `Last-Modified` response header is always sent when given a `filePath`,
    and not sent when given a `body`.
  * Unless `statusCode` is set in the configuration, conditional request headers
    are honored.
* Ranges:
  * Unless `statusCode` is set in the configuration:
    * The `Accept-Ranges` response header is always sent.
    * Range request headers are honored, including conditional range requests.

### `StaticFiles`

An application which serves static files from a local directory. In addition to
most of the [`BaseApplication`](#baseapplication) configuration options (all
but the `redirect*` options, which could cause chaos in this case), it accepts
the following configuration bindings:

* `acceptMethods` &mdash; `BaseApplication` configuration, but in this case the
  default is `['get', 'head']`.
* `etag` &mdash; ETag-generating options. If present and not `false`, the
  response comes with an `ETag` header. See "ETag Configuration" below for
  details.
* `cacheControl` &mdash; `cache-control` header definition. If present and not
  `false`, every cacheable response comes with the specified header.
* `notFoundPath` &mdash; Optional filesystem path to the file to serve when a
  file/path is not found. The indicated file will get sent back along with a
  `404` ("Not Found") status code.
* `siteDirectory` &mdash; Filesystem directory root for the files to serve.

```js
import { StaticFiles } from '@lactoserv/built-ins';

const applications = [
  {
    name:          'mySite',
    class:         StaticFiles,
    siteDirectory: '/path/to/site',
    notFoundPath:  '/path/to/404.html'
  }
];
```

There are a few notable things which _aren't_ configurable for this application.
These may be configurable in a future version, if there is sufficient and
reasonable demand:

* Content types:
  * The `Content-Type` headers are based on the file extensions of the files
    being served.
  * The mapping from extensions to MIME types is not configurable.
  * Textual file types are always reported to have `charset=utf-8`.
* Caching:
  * The `Last-Modified` response header is always sent.
  * Conditional request headers are honored.
* Ranges:
  * The `Accept-Ranges` response header is always sent.
  * Range request headers are honored, including conditional range requests.
* Directory responses:
  * "Naked" directory paths (i.e. ones that do not end with a slash) are
    redirected to the same path with a final slash appended.
  * Directory paths are responded to with the contents of a file called
    `index.html` in that directory, if it exists. The index file name is not
    configurable.
* These "odd" URL paths all cause not-found responses:
  * Ones with a `..` that would "back out" of the site directory.
  * Ones with an _encoded_ slash in them, that is to say literally `%2F`. (It is
    more trouble than it's worth to try to figure out a way for this to be
    implementable in a non-wacky unambiguous way.)
  * Ones with an internal empty path component, e.g. with `//` somewhere in
    them. Many filesystems will "collapse" multiple slashes away, but we choose
    to err on the side of being conservative and report this as an error rather
    than wade blithely into DWIM territory.
  * End with an empty path component (that is, end with a slash), when the path
    does not in fact correspond to a directory.
* The bodies of error and other non-content responses, other than `404`s, are
  not configurable.
* No files under the `siteDirectory` are filtered out and treated as not found.
  Notably, dotfiles &mdsah; that is, paths where the final component starts with
  a dot (`.`) &mdash; are served when corresponding files are found.

## Built-in Services

**Note about file names:** Several of the services accept a file path as a
configured property, which are typically required to be absolute paths. In
_some_ cases, the final name component of the path is treated as a prefix +
suffix combination, where the prefix is everything before a final dot (`.`), and
the suffix is the final dot and everything that follows. (For example,
`some.file.txt` would be parsed as prefix `some.file` and suffix `.txt`.) These
parsed names are used to construct _actual_ file names by inserting something in
between the prefix and suffix (such as a date stamp and/or a sequence number),
or in some cases just used as-is.

### `MemoryMonitor`

A service which occasionally checks the system's memory usage, and will force a
(hopefully) clean shutdown if memory usage is too high, with an optional grace
period to allow momentary usage spikes. It accepts the following configuration
bindings:

* `checkPeriod` &mdash; How often to check for memory usage being over the
  defined limit, specified as a duration value as described in
  [Durations](#durations). Optional. Minimum `1 sec` (which is frankly way too
  often). Default `5 min` (that is, once every five minutes).
* `gracePeriod` &mdash; Once a memory limit has been reached, how long it is
  allowed to remain at or beyond the maximum before this service takes action,
  specified as a duration value as described in [Durations](#durations). `0` (or
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
import { MemoryMonitor } from '@lactoserv/built-ins';

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

### `ProcessIdFile`

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
  a duration value as described in [Durations](#durations), or `null` to
  indicate "never." Optional and defaults to `null`. If specified, the value
  must be at least one second (so as to prevent excessive churn). This value is
  only meaningfully used when `multiprocess` is `true`.

```js
import { ProcessIdFile } from '@lactoserv/built-ins';

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

### `ProcessInfoFile`

A service which writes out a JSON-format file containing information about the
running system. The file name includes the process ID; and the file is written
when the system starts up, when it shuts down (if not killed with extreme
prejudice), and optionally on a periodic basis. It accepts the following
configuration bindings:

* `path` &mdash; Path to the file, with the final path component modified by
  infixing the process ID.
* `updatePeriod` &mdash; How long to wait between each file update while the
  system is running, specified as a duration value as described in
  [Durations](#durations), or `null` to indicate "never." Optional and defaults
  to `null`. If specified, the value must be at least one second (so as to
  prevent excessive churn).
* `save` &mdash; Optional file preservation configuration. If not specified, no
  file preservation is done.

```js
import { ProcessInfoFile } from '@lactoserv/built-ins';

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

### `RateLimiter`

A service which provides rate limiting of any/all of network connections,
HTTP-ish requests, or sent data. Rate limiting is modeled as a hybrid-model
"leaky token bucket." The configuration consists of three sections, each
optional, for `connections` (token unit, a connection), `requests` (token unit,
a request), and `data` (token unit, a byte). Each of these is configured as an
object with the following bindings:

* `flowRate` &mdash; The rate of token flow once any burst capacity is
  exhausted, specified as a frequency value as described in
  [Frequencies](#frequencies).
* `maxBurstSize` &mdash; The maximum allowed "burst" of tokens before
  rate-limiting takes effect.
* `maxQueueSize` &mdash; Optional maximum possible size of the wait queue, in
  tokens. This is the number of tokens that are allowed to be queued up for a
  grant, when there is insufficient burst capacity to satisfy all active
  clients. Attempts to queue up more result in token denials (e.g. network
  connections closed instead of sending bytes).
* `maxQueueGrantSize` -- Optional maximum possible size of a grant given to a
  requester in the wait queue, in tokens. If not specified, it is the same as
  the `maxBurstSize`. (It is really only meaningful for `data` limiting, because
  `connections` and `requests` are only requested one at a time.)

```js
import { RateLimiter } from '@lactoserv/built-ins';

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

### `RequestLogger`

A service which logs HTTP-ish requests in a textual form meant to be similar to
(though not identical to) what is often produced by other webservers (out in the
world). As of this writing, the exact format is _not_ configurable. It accepts
the following configuration bindings:

* `path` &mdash; Path to the log file(s) to write. When rotation is performed, a
  date stamp and (if necessary) sequence number are "infixed" into the final
  path component.
* `rotate` &mdash; Optional file rotation configuration. If not specified, no
  file rotation is done. See "File Rotation and Preservation" below for
  configuration details.
* `sendToSystemLog` &mdash; Boolean which, if `true`, causes requests and
  responses to _also_ get sent to the system log. (It's like getting an instance
  of `RequestSyslogger` for free.)

```js
import { RequestLogger } from '@lactoserv/built-ins';

const services = [
  {
    name:            'requests',
    class:           RequestLogger,
    path:            '/path/to/var/log/request-log.txt',
    rotate:          { /* ... */ },
    sendToSystemLog: true
  }
];
```

### `RequestSyslogger`

A service which logs very detailed information about HTTP-ish requests to the
_system_ log. Such logging in turn goes to wherever the system log goes (e.g.,
into a file). It does not accept any configuration bindings beyond the basics
of any service.

```js
import { RequestSyslogger } from '@lactoserv/built-ins';

const services = [
  {
    name:  'requestSyslog',
    class: RequestSyslogger
  }
];
```

### `SystemLogger`

A service which logs system activity either in a human-friendly or JSON form. It
accepts the following configuration bindings:

* `path` &mdash; Path to the log file(s) to write. When rotation is performed, a
  date stamp and (if necessary) sequence number are "infixed" into the final
  path component.
* `format` &mdash; Either `human` or `json`.
* `rotate` &mdash; Optional file rotation configuration. If not specified, no
  file rotation is done. See "File Rotation and Preservation" below for
  configuration details.

**Note:** As of this writing, the system tends to be _very_ chatty, and as such
the system logs can be quite massive. If you choose to use this service, it is
highly advisable to set up sane limits on the amount of storage used by
configuring `rotate`.

```js
import { SystemLogger } from '@lactoserv/built-ins';

const services = [
  {
    name:   'syslog-json',
    class:  SystemLogger,
    path:   '/path/to/var/log/system-log.json',
    format: 'json',
    rotate: { /* ... */ }
  }
];
```

## Configuration Sub-Objects

This section documents the configuration objects that are used within top-level
configurations.

### Specifying durations and frequencies/rates

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

#### Durations

The available units for durations are:

* `nsec` or `ns` &mdash; Nanoseconds.
* `usec` or `us` &mdash; Microseconds.
* `msec` or `ms` &mdash; Milliseconds.
* `sec` or `s` &mdash; Seconds.
* `min` or `m` &mdash; Minutes.
* `hr` or `h` &mdash; Hours.
* `day` or `d` &mdash; Days, where a "day" is defined to be exactly 24 hours.

#### Frequencies

The available units for frequencies are:

* `/nsec` or `/ns` &mdash; Per nanosecond.
* `/usec` or `/us` &mdash; Per microsecond.
* `/msec` or `/ms` &mdash; Per millisecond.
* `/sec` or `/s` &mdash; Per second.
* `/min` or `/m` &mdash; Per minute.
* `/hr` or `/h` &mdash; Per hour.
* `/day` or `/d` &mdash; Per (24-hour) day.

### Cache control configuration: `cacheControl`

Applications and services that might generate `cache-control` headers accept
a `cacheControl` binding. When it is absent or `false`, no such headers are
automatically generated. When it _is_ specified, then (generally speaking) the
value is used as a response header value for `cache-control` whenever such a
header is allowed.

The `cacheControl` value can be specified as a simple string value for the
header (e.g, `'public, max-age=86400'`), or it can be specified as an object
with bindings for each of the values.

In object form, property names are the `camelCase` versions of the in-header
names (e.g. `noStore` for `no-store`). Values can be:

* For present-vs-absent header values, such as `public` and `no-cache`:
  * A `boolean`, in which case `true` includes the value and `false` omits it.
* For duration values:
  * A duration as described in [Durations](#durations).

### ETag Configuration: `etag`

Applications and services that generate ETags accept an `etag` binding. When it
is absent or `false` (if allowed), no ETags are generated. If it is specified as
`true` or `{}` (the empty object), ETags are generated using a default
configuration. If it is specified as an object with bindings, the following
properties are recognized:

* `dataOnly` &mdash; Boolean indicating whether _only_ entity data should be
  used to generate tags, as opposed to using metadata such as file names and
  modification times. When `true`, filesystem-based applications/services use
  file data. When `false`, they use metadata. Defaults to `false`.
* `hashAlgorithm` &mdash; Algorithm to use to generate hashes. Allowed to be
  `sha1`, `sha256`, or `sha512`. Defaults to `sha256`.
* `hashLength` Number of characters to use from a generated hash when producing
  a tag. To have different lengths for strong vs. weak tags, specify this as an
  object with `strong` and `weak` properties. In object form, a `null` mapping
  indicates that the full hash length is to be used. Defaults to `{ strong:
  null, weak: 16}`.
* `tagForm` What ETag form to produce (indicating the "strength" of the tag),
  one of `weak`, `strong`, or `vary`. "Strong" tags are meant to convey that the
  entire underlying data is hashed into the tag, and as such it is safe to make
  range requests if a tag matches. "Weak" tags are, on the other hand, intended
  to indicate that the data was not fully hashed into the tag. If passed as
  `vary`, tags are produced in the arguably-most-appropriate form. Defaults to
  `vary`.

### File Rotation And Preservation

#### `rotate`

Some services accept `rotate` as a configured property, which enables automatic
file rotation and cleanup. A `rotate` configuration is an object with the
following bindings:

* `atSize` &mdash; Rotate when the file becomes the given size (in bytes) or
  greater. Optional, and if not specified (or if `null`), does not rotate based
  on size.
* `checkPeriod` &mdash; How often to check for a rotation condition, specified
  as a duration value as described in [Durations](#durations), or `null` to
  indicate "never check." Optional and defaults to `5 min`. If specified, the
  value must be at least one second (so as to prevent excessive churn). This is
  only meaningful if `atSize` is also specified.
* `maxOldBytes` &mdash; How many bytes' worth of old (post-rotation) files
  should be allowed, or `null` not to have a limit. The oldest files over the
  limit get deleted after a rotation.Optional, and defaults to `null`.
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

## Custom Applications and Services

Custom applications and classes are simply new subclasses of the framework
classes `BaseApplication` or `BaseService` in the module
`@lactoserv/sys-framework`. Refer to the documentation of these base classes
for more details, and look to any of the built-in applications or services for
implementation patterns which can be copied and altered to fit your needs.

- - - - - - - - - -
```
Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
