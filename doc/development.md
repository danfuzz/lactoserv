Development Guide
=================

### Building

```sh
$ ./scripts/build
...
Build complete!
$
```

By default, `build` deposits both a runnable build and a distribution tarball in
the directory `out` directly under the top-level source directory. The script
takes other options; `build --help` for details.

### Linting Etc.

```sh
$ ./scripts/lint

No linter errors! Yay!
$
```

There are also two tools which adjust source files to be in a standardized form:

* `./scripts/fix-package-json` -- Derives intra-project dependencies from the
  actual source files, and updates each module's `package.json` to match. It
  actually entirely rewrites the file with project-standard boilerplate and
  formatting.
* `./scripts/sort-imports` -- Sorts and arranges `import` lines into a
  project-standard form.

### Testing

Unit test files live in directories named `tests` directly under each local
package. They use Jest for both test definitons (`describe(...)`, `test(...)`)
and assertions (`expect(...)...`).

```sh
$ ./scripts/run-tests
...
No errors! Yay!
```

The `run-tests` script takes other options; `run-tests --help` for details.
TLDR: `run-tests --do=build` to do a build first, for convenience.

### Running

#### Run out of the built `out` directory

This will run the system using the example configuration defined in
`etc/config`, which includes a self-signed certificate for `localhost`, which
_might_ satisfy your local web browser.

```sh
$ ./scripts/run
...
```

The `run` script takes other options; `run --help` for details. TLDR common
options:
* `run --do=build` -- Do a build first, for convenience.
* `run --inspect` or `run --inspect=<arg>` -- Pass an `inspect` option to Node
  (to start the inspector/debugger immediately).

Recognized signals:
* `SIGHUP` -- Does an in-process system reload. (The system shuts down and then
  re-runs from near-scratch.)
* `SIGUSR1` -- Starts the Node inspector/debugger, listening on the usual port.
  (This is a standard signal recognized by Node. Just noting it here as a
  reminder or perhaps a TIL.)
* `SIGUSR2` -- Produces a heap dump file. Look in the log for the file name.
  (Writes to the current directory if it is writable.) The file can be inspected
  using the "Memory" panel available in the Chrome developer tools.
* `SIGINT` and `SIGTERM` -- Shuts down as cleanly as possible. (Note: `SIGINT`
  is usually what gets sent when you type `ctrl-C` in a console.)

- - - - - - - - - -
```
Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
