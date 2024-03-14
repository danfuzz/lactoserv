Contributing to Lactoserv
=========================

Bug reports and patches gladly accepted at
<https://github.com/danfuzz/lactoserv>.

### Bug reports / Feature requests

This project has issue templates for bug reports and feature requests. Please
use them, unless they _really_ don't fit with what you're trying to report.

### Patches / PRs

If you are submitting a PR, please ensure that it does not introduce either
linter complaints or test failures. You can check these via convenient scripts:

```
$ cd lactoserv
$ ./scripts/ubik dev lint
...
$ ./scripts/ubik run-tests --do=build
```

### Need some orientation?

See the [Development Guide](doc/development.md) to help get you started.
