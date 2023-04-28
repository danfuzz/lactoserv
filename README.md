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

4. Create a file called `scripts/lib/init.sh`, to hook up `bashy-core` and
   your project. The contents of this file should be:

   ```bash
   . "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/bashy-core/init.sh" \
   || return "$?"

   lib-init 'my-project'
   ```

   where (to reiterate) `my-project` is replaced with the actual name of your
   project.

5. Make a directory for your own scripts, `scripts/lib/my-project`.

6. Create your scripts in `scripts/lib/my-project`. At the top of each script,
   include the following:

   ```bash
   . "$(dirname "$(readlink -f "$0")")/../init.sh" || exit "$?"
   use-lib 'lib-name'
   use-lib 'lib-name'
   ...
   ```

   where `lib-name` is replaced with the name (directory name) of a library
   you will be using in the script.
