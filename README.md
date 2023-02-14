`lactoserv` Web Server
======================

[![Require Lint](https://github.com/danfuzz/lactoserv/actions/workflows/main.yml/badge.svg)](https://github.com/danfuzz/lactoserv/actions/workflows/main.yml)

Documentation:
* [`doc` directory](./doc), notably:
  * [Configuration Guide](./doc/configuration.md)
  * [Deployment Guide](./doc/deployment.md)
  * [Development Guide](./doc/development.md)

- - - - - - - - - -
This is a web server which knows how to serve a couple different types of
(more or less) static site.

### Features

* Can run multiple network endpoints, each (potentially) serving a different set
  of high-level applications.
* Several built-in applications:
  * Static file server (uses `Express.static`).
  * Redirect server.
  * More to come! TODO!
* Path-hierarchy specificity-based endpoint configuration, for endpoints that
  serve multiple applications. (This is as opposed to, notably, Express's
  built-in routing.)
* Can serve all of HTTP, HTTPS, and HTTP2. (HTTP2 will automatically downgrade
  to HTTPS for clients that can't do HTTP2.)
* Provides optional "token bucket" / "leaky bucket" rate limiting for
  connections, requests, and/or sent data (bytes / bandwidth).
* Optionally produces request logs, in a standard-ish form.
* Optionally produces detailed activity logs.
* JS-based configuration file format, which isn't actually that awful!
* For custom applications, reasonably friendly `async`-forward application
  framework, which uses Express-augmented `Request` and `Response` objects.
  Maximum ergonomics: Very straightforward application logic bottoming out at
  a familiar, well-worn, and well-tested low-level API.

### Implementation features

* Written in pure JavaScript, running on Node. (The only platform native code
  is from Node, not from this codebase nor from any imported modules.)
  * Uses Node's standard library for low-level networking and protocol
    implementation (TCP, TLS, HTTP*).
  * Uses Express for protocol handling on top of what Node provides (but with a
    bit of custom routing, see above).
  * Only modest use of external module dependencies (via `npm`).
* Built to be installed as a normal POSIX-ish service (though _without_ Node
  bundled into the installation).

- - - - - - - - - -

### Requirements

To build:
* Standard(ish) POSIX command-line environment (works on macOS and probably
  whatever flavor of Linux you happen to like).
* Recent(ish) version of Bash (works with what macOS ships, which is about as
  old a version as you'll find on any up-to-date OS).
* Recent version of Node (tested regularly on v18 and v19).
* Recent version of `jq` (v1.6).

To run (versions as above):
* Standard(ish) POSIX operating environment.
* Recent(ish) version of Bash.
* Recent version of Node.

- - - - - - - - - -

This project -- including all code, configuration, documentation, and other
files -- was created by the Lactoserv Authors (Dan Bornstein et alia).

```
Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
