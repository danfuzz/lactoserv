# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Miscellaneous Bashy-lib "built-in" commands
#

#
# Global variables
#

# The usage message defined via `define-usage`.
_bashy_usageMessage=''


#
# Library functions
#

# Calls an arbitrary command, and then exits the process with the given code.
function call-then-exit {
    local exitCode="$1"
    shift

    "$@"
    exit "${exitCode}"
}

# Defines a standard-form `usage` function. When `usage` is defined with this,
# any non-zero pending exit code (`$?`) becomes a process exit, so, for example,
# it is possible to say something like `process-args "$@" || usage --short`, and
# know that that exit the process on error.
function define-usage {
    local message="$1"

    _bashy_usageMessage="${message}"

    local func=$'function usage {
        local exitCode="$?"
        lib helpy print-usage --name="$(this-cmd-name)" "$@" "${_bashy_usageMessage}"
        (( exitCode )) && exit "${exitCode}"
    }'

    eval "${func}"
}
