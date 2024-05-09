Development Guide
=================

### Note about `scripts` directory

The `scripts` directory directly contains a "catch-all" command called `ubik`,
which is used to dispatch various subcommands in this project. This script
comes from the [Bashy-lib](https://github.com/danfuzz-bashy-lib) project, see
which for helpful advice about integrating it into your shell environment.

### Building

```sh
$ ubik dev build
...
Build complete!
$
```

By default, `dev build` deposits a runnable build in the directory `out`,
directly under the top-level source directory. The script takes other options;
`dev --help` for details.

`ubik dev clean` does what you (presumably) expect.

### Linting Etc.

```sh
$ ubik dev lint
...
No linter errors! Yay!
$
```

There are also some tools which adjust source files to be in a standardized
form:

* `ubik node-project fix-package-json` &mdash; Derives intra-project
  dependencies from the actual source files, and updates each module's
  `package.json` to match. It actually entirely rewrites the file with
  project-standard boilerplate and formatting.
* `ubik node-project reflow-jsdoc` &mdash; Reflows (fixes line breaks on) all
  the documentation comments in the source tree. **Note:** After running this,
  please double-check the results before committing, as this tool might produce
  results that indicate a need for the tool itself to be improved.
* `ubik node-project sort-imports` &mdash; Sorts and arranges `import` lines
  into a project-standard form.

### Testing

Unit test files live in directories named `tests` directly under each local
package. They use Jest for both test definitions (`describe(...)`, `test(...)`)
and assertions (`expect(...)...`).

```sh
$ ubik run-tests
...
No errors! Yay!
```

The `run-tests` script takes other options; `run-tests --help` for details.
TLDR:

* `run-tests --do=build` to do a build first, for convenience.
* `run-tests --type=unit-coverage` to generate a coverage report.

### Running

#### Run out of the built `out` directory

This will run the system using the example configuration defined in
`etc/config`, which includes a self-signed certificate for `localhost`, which
_might_ satisfy your local web browser.

```sh
$ ubik dev run
...
```

The `run` target of `dev` lets you pass arbitrary arguments to the server, by
using the `--run[]` option, and it also makes the default `dev` target be `run`.
TLDR very useful:

* `dev --run[]='--node-opts --inspect --'` or `dev --run[]='--node-opts
  --inspect=<arg>' --` &mdash; Pass an `inspect` option to Node (to start the
  inspector/debugger immediately).

You can also do a build first:

```sh
$ ubik dev build run
...
```

Recognized signals:
* `SIGHUP` &mdash; Does an in-process system reload. (The system shuts down and
  then re-runs from near-scratch.)
* `SIGUSR1` &mdash; Starts the Node inspector/debugger, listening on the usual
  port. (This is a standard signal recognized by Node. Just noting it here as a
  reminder or perhaps a TIL.)
* `SIGUSR2` &mdash; Produces a heap snapshot file. Look in the log for the file
  name. (Writes to the current directory if it is writable, and falls back to
  the value of environment variables `$HOME` or `$TMPDIR`, finally trying `/tmp`
  as a last-ditch effort. The file can be inspected using the "Memory" panel
  available in the Chrome developer tools. **Note:** Node documentation claims
  that a process needs _additional_ memory of about the same size as the heap
  being dumped; if the memory is not available you might find that your OS has
  killed the process before it completes the snapshot.
* `SIGINT` and `SIGTERM` &mdash; Shuts down as cleanly as possible. (Note:
  `SIGINT` is usually what gets sent when you type `ctrl-C` in a console.)

### Releasing

Use the script `update-version` will change the main version number, and
prepare the `CHANGELOG` file for release.

```sh
$ ubik update-version 123.45.6
```

- - - - - - - - - -
```
Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
