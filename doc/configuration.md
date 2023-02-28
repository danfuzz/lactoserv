Configuration Guide
===================

Lactoserv is configured with a JavaScript source file, not a JSON file. This
tactic is meant to remove the need for "halfhearted programming" facilities
baked into the server configuration parser itself. A configuration file is
expected to be a module (`.mjs` or `.cjs`) which has a single `default` export
consisting of a JavaScript object of the ultimate configuration. Very
skeletally (and reductively):

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

## Configuration object bindings

The following are the bindings that are expected at the top level of the
exported configuration object:

### hosts

`hosts` is a list of hostname bindings. These map possibly-wildcarded hostnames
to certificate-key pairs to use to authenticate the server as those hosts. This
section is only required if the server needs to respond to host-authenticated
protocols (which is of course probably going to be most of the time).

```js
const hosts = [
  {
    hostnames:   ['localhost', '*'],
    certificate: '-----BEGIN CERTIFICATE-----...',
    privateKey:  '-----BEGIN PRIVATE KEY-----...'
  },
  {
    hostnames:   ['*.example.com'],
    certificate: '-----BEGIN CERTIFICATE-----...',
    privateKey:  '-----BEGIN PRIVATE KEY-----...'
  },
  // ... more ...
];
```

Hostnames are allowed to start with a `*` to indicate a wildcard of _any number
of subdomains, including zero._ Note that this is unlike how wildcards work in
the underlying certificates, where a `*` denotes exactly one subdomain. And, to
be clear, the hostname `*` will match _any_ hostname at all, with any number of
subdomains.

**Note:** If you want to keep the text of the keys and certificates out of the
main configuration file, then the thing to do is just use the standard Node `fs`
package to read the contents.

### services

`services` is a list of system services to be used, with each element naming and
configuring one of them. A system service is simply an encapsulated bit of
functionality that gets hooked up to the system in general or to some other more
specific part of the system (typically, to one or more server endpoints).

There are two required bindings for each system service, its `name` and its
`class` (type). Beyond that, the configuration depends on the `class`. See below
for a list of all built-in system services. The `name` is used both when logging
activity (to the system log) and when hooking services up.

```js
const services = [
  {
    name:       'someService',
    class:      'ServiceClass',
    // ... class-specific configuration ...
  },
  // ... more ...
```

### applications

`applications` is a list of applications to be used, with each element naming
and configuring one of them. An application is an encapsulated bit of
functionality which specifically knows how to respond to external (HTTP-ish)
requests.

As with services, there are two required bindings for each application, its
`name` and its `class` (type). Beyond that, the configuration depends on the
`class`. See below for a list of all built-in applications. The `name` is used
both when logging activity (to the system log) and when hooking applications up
to servers (endpoints).

```js
const applications = [
  {
    name:       'someApplication',
    class:      'ApplicationClass',
    // ... class-specific configuration ...
  },
  // ... more ...
```

### servers

`servers` is a list of network endpoints to listen on, with each element naming
and configuring one of them. Each element has the following bindings:

* `name` &mdash; The name of the server. This is just used for logging and
  related informational purposes.
* `endpoint` &mdash; Details about the network endpoint. It is an object with
  the following bindings:
  * `hostnames` &mdash; A list of one or more hostnames to recognize, each name
    in the same form as accepted in the `hosts` section of the configuration. In
    most cases, it will suffice to just specify this as `['*']`.
  * `interface` &mdash; The address of the specific network interface to listen
    on, or `'*'` to listen on all interfaces. In most cases, `'*'` is a-okay.
  * `port` &mdash; The port number to listen on.
  * `protocol` &mdash; The protocol to speak. This can be any of `http`,
    `https`, or `http2`. `http2` includes fallback to `https`.
* `mounts` &mdash; A list of application mount points, each of which is an
  object with the following bindings:
  * `application` &mdash; The name of the application to mount.
  * `at` &mdash; The mount point(s) of the application, in the form of a
    protocol-less URI path, of the form `//hostname/base/path/` or a list of
    same, where `hostname` is a hostname in the same form as accepted in the
    `hosts` section of the configuration (including partial and full wildcards),
    and `base/path/` (which must end with a slash) is the base path under that
    hostname at which the application is to respond.
* `services` &mdash; An object which binds roles to system services by name.
  This binding is optional, and if present all roles are optional. The following
  roles are recognized:
  * `rateLimiter` &mdash; A request/data rate limiter.
  * `requestLogger` &mdash; A request logger.

```js
const servers = [
  {
    name: 'someServer',
    endpoint: {
      hostnames: ['*'],
      interface: '*',
      port:      8443,
      protocol:  'http2'
    },
    services: {
      rateLimiter:   'limiter',
      requestLogger: 'requests'
    },
    mounts: [
      {
        application: 'mainSite',
        at:          ['//*/', '//weird-server/just/for/example/'
      },
      {
        application: 'control',
        at:          '//*/.control/'
      },
      // ... more ...
    ]
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

### `Redirector`

An application which responds to all requests with an HTTP "redirect" response.
It accepts the following configuration bindings:

* `statusCode` &mdash; Optional HTTP status code to respond with. If not
  specified, it defaults to `301` ("Moved Permanently").
* `target` &mdash; The base URL to redirect to. This is prepended to the partial
  path of each request to form the final redirection URL.

```js
const applications = [
  {
    name:       'myRedirector',
    class:      'Redirector',
    statusCode: 308,
    target:     'https://example.com/boop/'
  }
];
```

### `StaticFiles`

An application which serves static files from a local directory. (This is a
thin veneer over the same functionality as bundled with Express.) It accepts the
following configuration bindings:

* `notFoundPath` &mdash; Optional filesystem path to the file to serve when a
  file/path is not found. The indicated file will get sent back along with a
  `404` ("Not Found") status code.
* `siteDirectory` &mdash; Filesystem directory root for the files to serve.

```js
const applications = [
  {
    name:          'mySite',
    class:         'StaticFiles',
    siteDirectory: '/path/to/site',
    notFoundPath:  '/path/to/404.html'
  },
];
```

## Built-in Services

**Note about file names:** Several of the services accept a file path as a
configured property, which are typically required to be absolute paths. In
_some_ cases, the final name component of the path is treated as a prefix +
suffix combination, where the prefix is everything before a final dot (`.`), and
the suffix is the final dot and everything that follows. (For example,
`some.file.txt` would be parsed as prefix `some.file` and suffix `.txt`.) These
parsed names are used to construct _actual_ file names by inserting something in
between the prefix and suffix (such as a sequence number), or in some cases just
used as-is.

**A note about file rotation:** Some of the services accept `rotate` as a
configured property, which enables automatic file rotation and cleanup. A
`rotate` configuration is an object with the following bindings:

* `atSize` &mdash; Rotate when the file becomes the given size (in bytes) or
  greater. Optional, and if not specified (or if `null`), does not rotate based
  on size.
* `checkSecs` &mdash; How often to check for a rotation condition, in seconds.
  Optional, and if not specified (or if `null`), does not ever check at all.
  This is only meaningful if `atSize` is also specified. Default `5 * 60`.
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

### `ProcessIdFile`

A service which writes a simple text file containing the process ID (number) of
the running system, and which optionally tries to deal with other simultaneous
server processes that also write to the same file. The file is written when the
system starts up, when it shuts down (if not killed with extreme prejudice), and
optionally on a periodic basis. It accepts the following configuration bindings:

* `path` &mdash; Path to the file. Must be an absolute path.
* `multiprocess` &mdash; Deal with multiple processes writing to the file?
  Optional and defaults to `false`. If `true`, whenever the file is written, it
  is read first and any process IDs found in it are kept if they are in fact
  still running.
* `updateSecs` &mdash; How many seconds to wait between each file update.
  Optional and defaults to "never." This is only meaningfully used when
  `multiprocess` is `true`.

```js
const services = [
  {
    name:         'process-id',
    class:        'ProcessIdFile',
    directory:    '/path/to/var/run',
    baseName:     'process.txt',
    multiprocess: true,
    updateSecs:   60 * 60
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
* `updateSecs` &mdash; How many seconds to wait between each file update while
  the system is running. Optional and defaults to "never."

```js
const services = [
  {
    name:       'process',
    class:      'ProcessInfoFile',
    directory:  '/path/to/var/run',
    baseName:   'process.json',
    updateSecs: 5 * 60
  }
];
```

### `RateLimiter`

A service which provides rate limiting of any/all of network connections,
server requests, or sent data. Rate limiting is modeled as a hybrid-model
"leaky token bucket." The configuration consists of three sections, each
optional, for `connections` (token unit, a connection), `requests` (token unit,
a request), and `data` (token unit, a byte). Each of these is configured as an
object with the following bindings:

* `flowRate` &mdash; The rate of token flow once any burst capacity is
  exhausted.
* `timeUnit` &mdash; The time unit of `flowRate`. This can be any of the
  following: `day` (defined here as 24 hours), `hour`, `minute`, `second`, or
  `msec` (millisecond).
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
const services = [
  {
    name:  'limiter',
    class: 'RateLimiter',
    connections: {
      maxBurstSize: 5,
      flowRate:     1,
      timeUnit:     'second',
      maxQueueSize: 15
    },
    requests: { /* ... */ },
    data: { /* ... */ }
  }
];
```

### `RequestLogger`

A service which logs HTTP(ish) requests in a textual form meant to be similar to
(though not identical to) what is often produced by other servers. As of this
writing, the exact format is _not_ configurable. It accepts the following
configuration bindings:

* `path` &mdash; Path to the log file(s) to write. When rotation is performed, a
  date stamp and (if necessary) sequence number are "infixed" into the final
  path component.
* `rotate` &mdash; Optional file rotation configuration. If not specified, no
  file rotation is done.

```js
const services = [
  {
    name:      'requests',
    class:     'RequestLogger',
    directory: '/path/to/var/log',
    baseName:  'request-log.txt',
    rotate:    { /* ... */ }
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
  file rotation is done.

**Note:** As of this writing, the system tends to be _very_ chatty, and as such
the system logs can be quite massive. If you choose to use this service, it is
highly advisable to set up sane limits on the amount of storage used by
configuring `rotate`.

```js
const services = [
  {
    name:      'syslog-json',
    class:     'SystemLogger',
    directory: '/path/to/var/log',
    baseName:  'system-log.json',
    format:    'json',
    rotate:    { /* ... */ }
  }
];
```


## Custom Applications and Services

As of this writing, there is no way to use the configuration file to add new
classes of application or service. The intention is for that to be added in the
future.

- - - - - - - - - -
```
Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
