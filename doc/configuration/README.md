Configuration Guide
===================

Chapters:
  * [1. Overview (below)](#overview)
  * [2. Common Configuration](./2-common-configuration.md)
  * [3. Built-In Services](./3-built-in-services.md)
  * [4. Built-In Applications](./4-built-in-applications.md)

## Overview

Lactoserv is configured with a JavaScript source file (notably, as opposed to a
JSON file). This tactic is meant to remove the need for "halfhearted
programming" facilities baked into a system configuration parser. A
configuration file is expected to be a module (`.mjs` or `.cjs`) which has a
single `default` export consisting of a JavaScript object of the ultimate
configuration. Very skeletally (and reductively):

```js
const config = {
  services: [
    // ... configuration ...
  ],
  hosts: [
    // ... configuration ...
  ],
  endpoints: [
    // ... configuration ...
  ],
  applications: [
    // ... configuration ...
  ]
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
to import them from `@lactoserv/webapp-builtins`.

## Component instantiation

Lactoserv configuration boils down to defining a tree of "component" objects.
These objects can be in one of two forms:

* A configuration object &mdash; a plain object &mdash; with all the required
  bindings of the component in question, along with an extra property `class`
  which indicates the class of the object (as a class object / constructor
  function, _not_ just a string name).
* A directly instantiated object, using the usual `new ClassName(...)` syntax,
  passing it a plain object of its configuration bindings.

In the rest of this guide, we use the plain object form, which arguably feels
more natural for a configuration file per se. When using Lactoserv as a
framework, though, the direct instantiation form is probably to be preferred.

```js
// Plain object form.
const config = {
  applications: [
    {
      class: StaticFiles,
      // ... more ....
    },
    // ... more ...
  ],
  // ... more ...
};
```

```js
// Direct instantiation form.
const webapp = new WebappRoot({
  applications: [
    new StaticFiles({
      // ... more ...
    }),
    // ... more ...
  ],
  // ... more ...
});
```

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
import { ServiceClass } from '@lactoserv/webapp-builtins';

const services = [
  {
    name:  'someService',
    class: ServiceClass,
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
import { ApplicationClass } from '@lactoserv/webapp-builtins';

const applications = [
  {
    name:  'someApplication',
    class: ApplicationClass,
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
  in the same form as accepted in the `hosts` section of the configuration.
  Defaults to `['*']`, which should suffice in most cases.
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
  * `accessLog` &mdash; A network access logger.
  * `dataRateLimiter` &mdash; A data rate limiter.
  * `rateLimiter` &mdash; A connection / request rate limiter.
* `application` &mdash; The name of the application which this endpoint should
  send requests to. **Note:** In order to serve multiple leaf applications, the
  one named here will have to be a routing application of some sort (such as
  [`PathRouter`](./4-built-in-applications.md#pathrouter), for example).

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
      accessLog:   'accessLog',
      rateLimiter: 'limiter'
    },
    application: 'mySite'
  },
```

## Custom Applications and Services

Custom applications and classes are simply new subclasses of the framework
classes `BaseApplication` or `BaseService` in the module
`@lactoserv/webapp-core`. Refer to the documentation of these base classes
for more details, and look to any of the built-in applications or services for
implementation patterns which can be copied and altered to fit your needs.

- - - - - - - - - -
```
Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
