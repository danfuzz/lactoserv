Changelog
=========

### v?

Notable changes:

* `bashy-core`:
  * New helper function: `set-array-from-lines` and `sort-array`.
  * `lib`: New option `--exec`. New feature `lib .`, `lib ..`, etc.
  * Expanded functionality of `helpy print-usage`.
  * `ubik`:
    * Finds functions from the library, not just commands (scripts).
    * Smarter error reporting.
  * `stderr`
    * New helper functions for more consistency amongst commands.
    * `progress-msg` defaults to enabled.
* `bashy-basics`:
  * New script `timey secs`. Subsumes and deprecates `timey now-secs`.
  * New helper functions `jbash-array` and `jpostproc`.
  * Renamed commands `json-*` to just `j*`.

### v2.1 -- 2023-05-12

Notable changes:

* Major rework of boilerplate files, for much faster library loading.
* Fix a handful of bugs that were introduced during the earlier restructuring.
* Rename "sublibrary" to "unit" in both prose and code.
* New "smart dispatch" shell function wrapper for `ubik`.
* Change the default of `rsync-local` to be `--no-delete` and not `--delete`,
  to match regular `rsync`.
* New scripts:
  * `tempy` (temporary file/dir) utilities.
  * `timey` (date/time) utilities.
  * Sublibrary `bashy-net`, with a few tools extracted from the sibling project
   `milky-cloud`.

### v2.0 -- 2023-05-02

Notable changes:

* Restructuring of the contents of scripts/lib, to make it easier to integrate
  multiple libraries.
* New facility for constructing commands with hierarchical subcommands (like how
  you can say `git commit` or `aws ec2 run-instances`).

### v1.0 -- 2023-05-01

Ex-post-facto release of the state of affairs before major rework was
merged into `main`.
