Bashy-lib
=========

<blockquote><i>
"Using Bash-3.2 plus the intersection of BSD and GNU tools is the worst form
of commandline scripting, except for all those other forms that have been tried
from time to time." &mdash; @danfuzz, with apologies to Sir Winston Churchill
</i></blockquote>

- - - - - - - - - -

This is a "core library" of sorts for Bash, containing a bunch of stuff that
I (@danfuzz) have found useful when developing new tools in Bash. It is
structured such that sublibraries may be composed into a unified whole, _mostly_
without interfering with each other, and _mostly_ without code duplication.

## To use

### Basic directory layout

```
project-base-directory/
  scripts/
    top-level-script
    top-level-script
    ubik -- general library caller (copy from this project)
    lib/
      _init.sh -- boilerplate (mostly) init file
      bashy-core/ -- copy of directory from this project
      other-lib/ -- copy of other library (from this project or elsewhere)
      my-project-lib/
        _init.sh -- sublibrary-specific init file (with some boilerplate)
        _prereqs -- sublibrary-specific prerequisites checker (optional)
        _setup.sh -- sublibrary-specific setup (optional)
        project-script
        project-script
        project-subcommand-dir/
          _init.sh -- boilerplate init file
          _run -- default subcommand script (optional)
          subcommand-script
          subcommand-script
          subsub-dir/
            _run -- default subcommand script (optional)
            subcommand-script
        project-subcommand-dir/
          _init.sh -- boilerplate init file
          _run -- default subcommand script (optional)
          subcommand-script
          subcommand-script
```

### TLDR

* Copy the `scripts` directory of this project.

* Put your scripts in one of two places:
  * A sublibrary directory for your project in `scripts/lib`.
  * Directly in `scripts` (if they don't need to be called by other scripts).

* Put a non-executable file called `_init.sh` in every directory where a script
  lives. This file is included by your scripts and serves to link them up to the
  main library.

### Detailed Instructions

1. Pick a name for your project's "script library" directory, typically at the
   top level of your project. `scripts` and `bin` are good choices.

   The rest of these instructions assume you picked `scripts`, for ease of
   exposition. Adjust accordingly.

2. Pick a symbolic name for your project / product, e.g. that can (and will) be
   used as a directory name.

   The rest of these instructions assume you named your project `my-project`.
   Adjust accordingly.

3. Copy the items from the `scripts` directory in _this_ project, that you are
   interested in using, into `scripts` in your project. At a minimum, you need
   to include the `lib/bashy-core` and `lib/_init.sh`. The files directly in
   `scripts` (`_init.sh` and `ubik`) are needed if you want to expose library
   scripts "publicly" in `scripts` (at least, in the standard way supported by
   this project).

   **Note:** `lib/_init.sh` file will need to be adjusted if `scripts` is not
   directly under your project's base directory.

4. Make a directory for your own script sub-library, `scripts/lib/my-project`.

5. Create a file called `scripts/lib/my-project/_init.sh`, to hook up
   your project's script sub-library to `bashy-core`. The file should just
   contain this:

   ```bash
   . "${BASH_SOURCE[0]%/lib/*}/lib/_init.sh" || return "$?"
   ```

6. Create one or more scripts in `scripts/lib/my-project`, or directly in
   `scripts`. At the top of each script, include the following:

   ```bash
   . "$(dirname "$(readlink -f "$0")")/_init.sh" || exit "$?"
   ```

   **Note:** Scripts directly in `scripts` should generally not be called from
   other scripts. See below about "exposing" a script in your sublibrary for
   direct "public" calling.

7. Create one or more subcommand directories in `scripts/lib/my-project`. Add
   an `_init.sh` file to it (same as in step 5), and one or more scripts or
   subcommand directories (same as step 6 or this step).

8. To expose a script in a sublibrary for direct "public" usage, create a script
   with its name in the top-level `scripts` directory, with the following
   contents, which causes it to call through to the sublibrary script:

   ```bash
   . "$(dirname "$(readlink -f "$0")")/_init.sh" || exit "$?"
   lib "$(this-cmd-name)" "$@"
   ```

**Note:** The files named with a `.sh` suffix are _not_ supposed to be marked
executable (`chmod +x ...`). These are _include_ files.
