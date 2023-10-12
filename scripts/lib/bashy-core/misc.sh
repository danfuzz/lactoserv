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

# Defines a standard-form `usage` function, optionally adding standardized help
# options. With option `--with-help`, this defines standard help options
# `--help` and short form `-h`, and appends help-for-help to the description.
function define-usage {
    local withHelp=0
    if [[ $1 == --with-help ]]; then
        withHelp=1
        shift
    fi

    local message="$1"

    _bashy_usageMessage="${message}"

    if (( withHelp )); then
        opt-action --call='{ usage; exit }' help/h \
        || return "$?"

        _bashy_usageMessage+="$(printf '%s\n' \
            '' \
            '${name} [--help | -h]' \
            '' \
            'Displays this message.'
        )"
    fi

    local func=$'function usage {
        lib helpy print-usage --name="$(this-cmd-name)" "$@" "${_bashy_usageMessage}"
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

    # Note: The assignment to a new variable has the beneficial side-effect of
    # compacting away any gaps (deleted elements) in the original.

    _misc_sort-array-inner

    eval "${_bashy_arrayName}=(\"\${_bashy_arr[@]}\")"
}

# Helper for passing multiple values to multi-value options (`--name[...]`),
# which formats its arguments so that the argument processor can recover the
# original multiple values. This works for any number of values including zero
# or one. Use it like `cmd --opt-name["$(values ...)"]`, or more specifically
# when you want to pass an array like `cmd --opt-name["$(values
# "${arrayName[@]}")"]`.
function vals {
    case "$#" in
        0)
            : # No need to emit anything.
            ;;
        1)
            printf '%q\n' "$1"
            ;;
        *)
            printf '%q' "$1"
            shift
            printf ' %q' "$@"
            printf '\n'
            ;;
    esac
}


#
# Helper functions
#

# Main guts of `sort-array`. This is separated out to avoid local variable
# shadowing where the `eval` occurs. This assumes `_bashy_arr` is the array to
# work on. The algorithm is shell sort, with just one round (of selection sort)
# for small inputs.
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
