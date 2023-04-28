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

1. Pick a name for your project's "script library" directory, typically at the
   top level of your project (top-levelness is assumed in some of the scripts).
   `scripts` and `bin` are good choices.

   The rest of these instructions assume you picked `scripts`, for ease of
   exposition. Adjust accordingly.

2. Pick a symbolic name for your project / product, e.g. that can (and will) be
   used as a directory name.

   The rest of these instructions assume you named your project `my-project`.
   Adjust accordingly.

3. Copy the items from the `scripts/lib` directory in _this_ project, that you
   are interested in using, into `scripts/lib` in your project. At a minumum,
   you need to include `bashy-core`.

4. Make a directory for your own script sub-library, `scripts/lib/my-project`.

5. Create a file called `scripts/lib/my-project/init.sh`, to hook up
   `bashy-core` to your project's script sub-library. The contents of this file
   should be:

   ```bash
   . "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../bashy-core/init.sh" \
   || return "$?"
   ```

   where (to reiterate) `my-project` is replaced with the actual name of your
   project.

6. Create your scripts in `scripts/lib/my-project`. At the top of each script,
   include the following:

   ```bash
   . "$(dirname "$(readlink -f "$0")")/../init.sh" || exit "$?"
   use-lib 'lib-name'
   use-lib 'lib-name'
   ...
   ```

   where `lib-name` is replaced with the name (directory name) of a library
   you will be using in the script. You need to name each used library _except_
   `bashy-core` (which is necessary and assumed) and your own library.

**Note:** The files named with a `.sh` suffix are _not_ supposed to be marked
executable (`chmod +x ...`). These are _include_ files.
