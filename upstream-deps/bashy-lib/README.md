Bashy-lib
=========

This is a "core library" of sorts for Bash, containing a bunch of stuff that
I (@danfuzz) have found useful when developing new tools in Bash.

It is built to be a base for other libraries, including an initialization file,
`init-product.sh`, which is meant to be customized for the downstream context.

## To use

1. Copy the `lib` directory (as the name `lib` per se) into a directory called
   `scripts` or `bin` (or similar) at the top level of the project in which it
   is to be used.

2. Edit `init-product.sh` to fill in product- / project-specific details.

3. Add your own scripts in that `scripts` (etc.) directory. At the top of those
   scripts, include this library with this line:

   ```bash
   . "$(dirname "$(readlink -f "$0")")/lib/init.sh" || exit "$?"
   ```
