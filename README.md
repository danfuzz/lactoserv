`lactoserv` Web Server
======================

[![Require Lint](https://github.com/danfuzz/lactoserv/actions/workflows/main.yml/badge.svg)](https://github.com/danfuzz/lactoserv/actions/workflows/main.yml)

- - - - - - - - - -
This is a web server which knows how to serve a couple different types of
(more or less) static site.

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
