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
  serve multiple applications. (This is as opposed to, notably, Express's
  built-in routing.)
* Can serve all of HTTP, HTTPS, and HTTP2. (HTTP2 will automatically downgrade
  to HTTPS for clients that can't do HTTP2.)
* Implements (optional) straightforward "token bucket" / "leaky bucket" rate
  limiting for connections, requests, and/or sent data (bytes / bandwidth).
* Produces request logs in a standard-ish form.
* Produces detailed activity logs.
* JS-based configuration file format, which isn't actually that awful!

### Implementation features

* Written in pure JavaScript, running on Node. (The only platform native code
  is from Node, not from this codebase nor from any imported modules.)
  * Uses Node's standard library for low-level networking and protocol
    implementation (TCP, TLS, HTTP*).
  * Uses Express for protocol handling on top of what Node provides (but with a
    bit of custom routing, see above).
  * Only modest use of external module dependencies.
* Built to be installed as a normal POSIX-ish service (though _without_ Node
  bundled into the installation). (TODO.)

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

### Building, Linting, Testing

#### Build

```sh
$ ./scripts/build
...
Build complete!
$
```

By default, `build` deposits both a runnable build and a distribution tarball in
the directory `out` directly under the top-level source directory. The script
takes other options; `build --help` for details.

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

Recognized signals:
* `SIGHUP` -- Does an in-process system reload. (The system shuts down and then
  re-runs from near-scratch.)
* `SIGUSR2` -- Produces a heap dump file. Look in the log for the file name.
  (Writes to the current directory if it is writable.) The file can be inspected
  using the "Memory" panel available in the Chrome developer tools.
* `SIGINT` and `SIGTERM` -- Shuts down as cleanly as possible. (Note: `SIGINT`
  is usually what gets sent when you type `ctrl-C` in a console.)

#### Install and run in production

TODO! Coming soon!
