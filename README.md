`lactoserv` Web Server
======================

[![Require Lint](https://github.com/danfuzz/lactoserv/actions/workflows/main.yml/badge.svg)](https://github.com/danfuzz/lactoserv/actions/workflows/main.yml)

- - - - - - - - - -
This is a web server which knows how to serve a couple different types of
(more or less) static site.

### Features

* Can run multiple network endpoints, each (potentially) serving a different set
  of high-level applications.
* Several built-in applications:
  * Static asset server.
  * Redirect server.
  * More to come! TODO!
* Path-hierarchy specificity-based endpoint configuration, for endpoints that
  serve multiple applications. (This is as opposed to, notably, Express.)
* Can serve all of HTTP, HTTPS, and HTTP2. (HTTP2 will automatically downgrade
  to HTTPS for clients that can't do HTTP2.)
* Implements (optional) straightforward "token bucket" / "leaky bucket" rate
  limiting for connections, requests, and/or sent data (bytes / bandwidth).
* Produces standard-ish form request logs.
* Produces detailed activity logs.
* Inscrutable configuration file format.
  (To be fixed soon! TODO!)

### Implementation features

* Written in pure JavaScript, running on Node. (The only platform native code
  is from Node, not from this codebase nor from any imported modules.)
* Built to be installed as a normal POSIX-ish service. (TODO.)

- - - - - - - - - -

### Requirements

To build:
* Standard(ish) POSIX command-line environment.
* Recent(ish) version of Bash (works with what macOS ships).
* Recent version of Node.
* Recent version of `jq`.

To run:
* Standard(ish) POSIX operating environment.
* Recent(ish) version of Bash.
* Recent version of Node.

### Building, Linting, Testing

#### Build

```sh
$ ./scripts/build
...
Build complete!
$
```

`build` deposits a build in the directory `out`, directly under the top-level
source directory. The script takes other options; `build --help` for details.

#### Lint

```sh
$ ./scripts/lint

No linter errors! Yay!
$
```

#### Test

```sh
$ ./scripts/run-tests
...
No errors! Yay!
```

The `run-tests` script takes other options; `run-tests --help` for details.
TLDR: `run-tests --do=build` to do a build first, for convenience.

### Running

#### Run out of the built `out` directory

```sh
$ ./scripts/run
...
```

The `run` script takes other options; `run --help` for details. TLDR: `run
--do=build` to do a build first, for convenience.

#### Install and run in production

TODO! Coming soon!
