# Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
# All code and assets are considered proprietary and unlicensed.

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
    lib json-length "$@"
}

# Calls `lib json-val`.
function jval {
    lib json-val "$@"
}
