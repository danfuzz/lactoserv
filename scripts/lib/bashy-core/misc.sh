# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Miscellaneous Bashy-lib "built-in" commands / functions
#


#
# Global variables
#

# The usage message defined via `define-usage`.
_bashy_usageMessage=''


#
# Library functions
#

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

# Splits a multi-line string into an array. Assigns the indicated variable.
# Note: This ignores blank lines.
function set-array-from-lines {
    # Note: Because we use `eval`, local variables are given name prefixes to
    # avoid conflicts with the caller.
    local _bashy_name="$1"
    local _bashy_value="$2"

    # No choice but `eval` for Bash-3.2 compatibility.
    local _bashy_oldIfs="${IFS}"
    IFS=$'\n'
    eval "${_bashy_name}=(\${_bashy_value})"
    IFS="${_bashy_oldIfs}"
}

# Sorts an array in-place.
function sort-array {
    # Because of Bash-3.2 compatibility, this is the sanest way to get the
    # array. `_bashy_` prefix to hopefully avoid naming conflicts.
    local _bashy_arrayName="$1"
    local _bashy_arr
    eval "_bashy_arr=(\"\${${_bashy_arrayName}[@]}\")"

    _misc_sort-array-inner

    eval "${_bashy_arrayName}=(\"\${_bashy_arr[@]}\")"
}


#
# Helper functions
#

# Main guts of `sort-array`. This is separated out to avoid local variable
# shadowing where the `eval` occurs. This assumes `_bashy_arr` is the array to
# work on. The algorithm is shell sort, with just one round (that is, insertion
# sort) for small inputs.
function _misc_sort-array-inner {
    local count="${#_bashy_arr[@]}"

    local gap
    if (( count >= 10 )); then
        gap=$(( count / 2 ))
    else
        gap=1
    fi

    local i j slice temp
    while (( gap > 0 )); do
        for (( slice = 0; slice < gap; slice++ )); do
            for (( i = slice; (i + gap) < count; i += gap )); do
                for (( j = i + gap; j < count; j += gap )); do
                    if [[ ${_bashy_arr[i]} > ${_bashy_arr[j]} ]]; then
                        temp="${_bashy_arr[i]}"
                        _bashy_arr[i]="${_bashy_arr[j]}"
                        _bashy_arr[j]="${temp}"
                    fi
                done
            done
        done
        (( gap /= 2 ))
    done
}
