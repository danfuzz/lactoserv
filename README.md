`lactoserv` Web Application Server
==================================

[![Build](https://github.com/danfuzz/lactoserv/actions/workflows/main.yml/badge.svg)](https://github.com/danfuzz/lactoserv/actions/workflows/main.yml)

Documentation:
* [`doc` directory](./doc), notably:
  * [Configuration Guide](./doc/configuration.md)
  * [Deployment Guide](./doc/deployment.md)
  * [Development Guide](./doc/development.md)
  * [**Quick Start Guide**](./doc/quick-start.md)

- - - - - - - - - -

**Lactoserv is a deployable experiment to see just how far one can go in terms
of directly serving network traffic (specifically HTTP-ish protocols) in Node,
with minimal intermediation. It is actively run in production on a small number
of public-facing websites.**

It is also intended as a solid foundation for prototyping high-level OS system
services.

More concretely, Lactoserv is a web application server which knows how to serve
a handful of different types of built-in "application," with plans to add more
and to enable straightforward custom applications.

### Features

* Can run multiple network endpoints, each serving a different set of high-level
  applications.
* Several built-in applications:
  * Simple response server (approximately a single-file static server).
  * Static file server.
  * Redirect server.
  * More to come! TODO!
* Path-hierarchy specificity-based endpoint configuration, for endpoints that
  serve multiple applications. This is as opposed to, notably, many (most?) of
  the "competing" Node webapp frameworks, which just do linear dispatch.
* Can serve all of HTTP, HTTPS, and HTTP2. (HTTP2 will automatically downgrade
  to HTTPS for clients that can't do HTTP2.)
* Provides optional "token bucket" / "leaky bucket" rate limiting for
  connections, requests, and/or sent data (bytes / bandwidth).
* Optionally produces request logs, in a standard-ish form.
* Optionally produces detailed system activity logs.
* JS-based configuration file format, which isn't actually that awful!
* For custom (non-built-in) applications, reasonably modern `async`-forward
  application framework, which uses wrappers around the underlying Node request
  and response objects, providing a friendly and approachable API. Maximum
  ergonomics: Very straightforward application logic bottoming out at a
  well-tested low-level implementation.

### Implementation features

* Written in pure JavaScript (per se), running on Node. (The only platform
  native code is from Node, not from this codebase nor from any imported
  modules.)
  * Uses Node's standard library for low-level networking and protocol
    implementation (TCP, TLS, HTTP*).
  * Only modest use of external module dependencies (via `npm`).
  * Notably, does _not_ depend on any other webapp framework (Express, Fastify,
    etc.).
* Built to be installed as a normal POSIX-ish service (though _without_ Node
  bundled into the installation).
* Developed using automated unit and integration tests. (As of this writing,
  test coverage stats indicate _decent_ but not _outstanding_ coverage.)

- - - - - - - - - -

### Requirements

To build:
* Standard-ish POSIX command-line environment. (It is known to build on recent
  versions of macOS and at least one flavor of Linux. It _might_ build on
  Windows, but if it does nobody has told anyone on the project.)
* Recent-ish version of Bash (works with what macOS ships, which is about as
  old a version as you'll find on any up-to-date OS).
* Node v20 or later (tested regularly on v20 and v21).
* Recent version of `jq` (v1.6 or later).

To run (versions as above):
* Standard-ish POSIX operating environment.
  * Notably, it assumes `openssl` (or similar) is available in the runtime
    environment. (This is only used when the system is asked to generate
    self-signed certificates. If you don't need to do that, then Node's
    built-in SSL implementation suffices.)
* Recent-ish version of Bash.
* Node v20 or later. This is required because the project uses:
  * The relatively new `/v` flag on regular expressions, which became available
    as of v20.
  * The module `inspector/promises` (for heap dumps), which became available as
    of v19.

- - - - - - - - - -
```
Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
