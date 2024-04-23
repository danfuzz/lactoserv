`lactoserv` Web Application Server
==================================

[![Build](https://github.com/danfuzz/lactoserv/actions/workflows/main.yml/badge.svg)](https://github.com/danfuzz/lactoserv/actions/workflows/main.yml)

See also:
* Documentation:
  * [`doc` directory](./doc), notably:
    * [Configuration Guide](./doc/configuration/README.md)
    * [Deployment Guide](./doc/deployment.md)
    * [Development Guide](./doc/development.md)
    * [**Quick Start Guide**](./doc/quick-start.md)
* [Recent Changes](./CHANGELOG.md)
* [Stable Releases](./RELEASES.md)

- - - - - - - - - -

**Lactoserv is a deployable experiment to see just how far one can go in terms
of directly serving network traffic (specifically HTTP-ish protocols) in Node,
with minimal intermediation. It is actively run in production on a small number
of public-facing websites.**

It is also intended as a solid foundation for prototyping high-level OS system
services.

More concretely, Lactoserv is a web server which knows how to serve a handful of
different types of built-in "application," with plans to add more. And it
provides a programming framework for defining custom applications either
standalone or together with others, including both built-in and other custom
applications.

### Features

* Networking:
  * Can run multiple network endpoints, each serving a different application or
    set thereof.
  * Can serve all of HTTP, HTTPS, and HTTP2. (HTTP2 will automatically downgrade
    to HTTPS for clients that can't do HTTP2.)
* JS-based configuration file format, which isn't actually that awful!
* Several built-in applications, including:
  * Five request routing and filtering applications, to cover most routing
    needs.
  * Three "leaf" applications, for regular content responses and redirection.
  * More to come!
* Several built-in services:
  * "Token bucket" / "leaky bucket" rate limiting for connections, requests,
    and/or sent data (bytes / bandwidth).
  * Access logging (that is, network request "access logs" in the usual sense),
    in a recognizable standard-ish form.
  * Detailed system activity logging, in a couple of different formats.
* The ability to define custom applications and services, using a modern
  promise-based application framework. Instead of directly dealing with the
  quirky core Node request and response objects, this framework exposes a
  friendlier and more approachable API. Maximum ergonomics: Very straightforward
  application logic bottoms out at a well-tested low-level implementation.

### Implementation features

* Written in pure JavaScript (per se), running on Node. (The only platform
  native code is from Node, not from this codebase nor from any imported
  modules.)
  * Uses Node's standard library for low-level networking and protocol
    implementation (TCP, TLS, HTTP*).
  * Only sparingly uses external module dependencies (via `npm`).
  * Notably, does _not_ depend on any other web application framework (Express,
    Fastify, etc.).
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
