# Copyright 2022 Dan Bornstein.
# Licensed AS IS and WITHOUT WARRANTY under the Apache License, Version 2.0.
# Details: <http://www.apache.org/licenses/LICENSE-2.0>

#
# Library functions: Convenience callers for external scripts. These are for
# items that are used often enough to be shorter to name, or in contexts that
# require a simple function name.
#

# Calls `lib json-array`.
function jarray {
    lib json-array "$@"
}

# Calls `lib json-get`.
function jget {
    lib json-get "$@"
}

# Calls `lib json-length`.
function jlength {
    lib json-get "$@"
}

# Calls `lib json-val`.
function jval {
    lib json-val "$@"
}
