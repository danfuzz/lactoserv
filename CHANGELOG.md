Changelog
=========

### v2.0.1 -- ??

Notable changes:

* Major rework of boilerplate files, for much faster library loading.
* Rename "sublibrary" to "unit" in both prose and code.
* New `tempy` (temporary file/dir) utilities.
* Fix a handful of bugs that were introduced during the earlier restructuring.

### v2.0 -- 2023-05-02

Notable changes:

* Restructuring of the contents of scripts/lib, to make it easier to integrate
  multiple libraries.
* New facility for constructing commands with hierarchical subcommands (like how
  you can say `git commit` or `aws ec2 run-instances`).

### v1.0 -- 2023-05-01

Ex-post-facto release of the state of affairs before major rework was
merged into `main`.
