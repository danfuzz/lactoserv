Integration Tests
=================

This directory is for integration tests. As of this writing, things here are a
bit ad-hoc and not 100% automated.

To run these tests, first build the system. Then, either:

* Run the tests fully standalone:
  * Run `run-all --run-server` in this directory, or run `ubik run-tests
    --type=integration`.
* Run the tests while monitoring the log:
  * Run the system, e.g. by `ubik dev run`.
  * Run the tests with `run-all` in this directory (with no options).

- - - - - - - - - -
```
Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
