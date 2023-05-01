Bashy-lib
=========

This is a "core library" of sorts for Bash, containing a bunch of stuff that
I (@danfuzz) have found useful when developing new tools in Bash.

It is built to be a base for other libraries, including an initialization file,
`init-product.sh`, which is meant to be customized for the downstream context.

## To use -- OLD INSTRUCTIONS

1. Copy the `lib` directory (as the name `lib` per se) into a directory called
   `scripts` or `bin` (or similar) at the top level of the project in which it
   is to be used.

2. Edit `init-product.sh` to fill in product- / project-specific details.

3. Add your own scripts in that `scripts` (etc.) directory. At the top of those
   scripts, include this library with this line:

   ```bash
   . "$(dirname "$(readlink -f "$0")")/lib/init.sh" || exit "$?"
   ```

## To use -- NEW INSTRUCTIONS

### Basic directory layout

```
project-base-directory/
  scripts/
    top-level-script
    top-level-script
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

4. Make a directory for your own script sub-library, `scripts/lib/my-project`.

5. Create a file called `scripts/lib/my-project/init.sh`, to hook up
   `bashy-core` to your project's script sub-library. The file should start
   with this:

   ```bash
   . "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../init.sh" \
   || return "$?"
   ```

   In addition, this is where you can add project-specific definitions,
   including notably specifying prerequisite checks.

6. Create one or more scripts in `scripts/lib/my-project`. At the top of each
   script, include the following:

   ```bash
   . "$(dirname "$(readlink -f "$0")")/../init.sh" || exit "$?"
   ```

7. Create one or more subcommand directories in `scripts/lib/my-project`. Add
   an `init.sh` file to it (same as in step 5), and one or more scripts or
   subcommand directories (same as step 6 or this step).

**Note:** The files named with a `.sh` suffix are _not_ supposed to be marked
executable (`chmod +x ...`). These are _include_ files.
