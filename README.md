Bashy-lib
=========

This is a "core library" of sorts for Bash, containing a bunch of stuff that
I (@danfuzz) have found useful when developing new tools in Bash.

## To use

### Basic directory layout

```
project-base-directory/
  scripts/
    top-level-script
    top-level-script
    ubik -- general library caller (copy from this project)
    lib/
      init.sh -- boilerplate (mostly) init file
      bashy-core/ -- copy of directory from this project
      other-lib/ -- copy of other library (from this project or elsewhere)
      my-project-lib/
        init.sh -- sublibrary-specific init file (with some boilerplate)
        _prereqs -- sublibrary-specific prerequisites checker (optional)
        _setup.sh -- sublibrary-specific setup (optional)
        project-script
        project-script
        project-subcommand-dir/
          init.sh -- boilerplate init file
          _run -- default subcommand script (optional)
          subcommand-script
          subcommand-script
          subsub-dir/
            _run -- default subcommand script (optional)
            subcommand-script
        project-subcommand-dir/
          init.sh -- boilerplate init file
          _run -- default subcommand script (optional)
          subcommand-script
          subcommand-script
```

### Detailed Instructions

1. Pick a name for your project's "script library" directory, typically at the
   top level of your project. `scripts` and `bin` are good choices.

   The rest of these instructions assume you picked `scripts`, for ease of
   exposition. Adjust accordingly.

2. Pick a symbolic name for your project / product, e.g. that can (and will) be
   used as a directory name.

   The rest of these instructions assume you named your project `my-project`.
   Adjust accordingly.

3. Copy the items from the `scripts/lib` directory in _this_ project, that you
   are interested in using, into `scripts/lib` in your project. At a minimum,
   you need to include the `bashy-core` directory and the `init.sh` file. The
   `init.sh` file will need to be adjusted if `scripts` is not directly under
   your project's base directory.

4. Create a file `scripts/lib/init.sh`, with the following lines:

   ```bash
   . "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/bashy-core/init.sh" \
   || return "$?"

   base-dir --set=../..
   ```

   This (a) loads the core library and all sublibraries, and (b) tells the
   system where the top-of-project directory is.

5. Make a directory for your own script sub-library, `scripts/lib/my-project`.

6. Create a file called `scripts/lib/my-project/init.sh`, to hook up
   `bashy-core` to your project's script sub-library. The file should just
   contain this:

   ```bash
   . "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../init.sh" \
   || return "$?"
   ```

7. Create one or more scripts in `scripts/lib/my-project`. At the top of each
   script, include the following:

   ```bash
   . "$(dirname "$(readlink -f "$0")")/init.sh" || exit "$?"
   ```

8. Create one or more subcommand directories in `scripts/lib/my-project`. Add
   an `init.sh` file to it (same as in step 6), and one or more scripts or
   subcommand directories (same as step 7 or this step).

9. To expose a script for direct usage, create a script with its name in the
   top-level `scripts` directory, with the following contents:

   ```bash
   # Just redirect to the same-named script in the library.
   thisCmdPath="$(readlink -f "$0")"
   exec "${thisCmdPath%/*}/ubik" "${thisCmdPath##*/}" "$@"
   ```

**Note:** The files named with a `.sh` suffix are _not_ supposed to be marked
executable (`chmod +x ...`). These are _include_ files.
