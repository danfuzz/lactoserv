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
# This ignores blank lines by default. With the option `--nl-terminated`, this
# instead expects every line to be newline-terminated and will report an error
# if the last character in the given string is _not_ a newline.
function set-array-from-lines {
    # Note: Because we use `eval`, local variables are given name prefixes to
    # avoid conflicts with the caller.
    local _bashy_nlTerm=0
    if [[ $1 == --nl-terminated ]]; then
        _bashy_nlTerm=1
        shift
    fi

    local _bashy_name="$1"
    local _bashy_value="$2"

    local _bashy_parsed=()
    if (( _bashy_nlTerm )); then
        while [[ ${_bashy_value} =~ ^([^$'\n']*)$'\n'(.*)$ ]]; do
            _bashy_parsed+=("${BASH_REMATCH[1]}")
            _bashy_value="${BASH_REMATCH[2]}"
        done
        if [[ ${_bashy_value} != '' ]]; then
            error-msg --file-line=1 'Last line unterminated.'
            return 1
        fi
    else
        while [[ ${_bashy_value} =~ ^$'\n'*([^$'\n']+)(.*)$ ]]; do
            _bashy_parsed+=("${BASH_REMATCH[1]}")
            _bashy_value="${BASH_REMATCH[2]}"
        done
    fi

    # No choice but `eval` for Bash-3.2 compatibility.
    eval "${_bashy_name}=(\"\${_bashy_parsed[@]}\")"
    return "$?"
}

# Reverse of `vals`: Assigns parsed elements of the given multi-value string
# (as produced by `vals` or similar) into the indicated variable, as an array.
# Values must be separated by at least one whitespace character. The option
# `--quiet` suppresses error output.
function set-array-from-vals {
    # Note: Because we use `eval`, local variables are given name prefixes to
    # avoid conflicts with the caller.
    local _bashy_quiet=0
    if [[ $1 == '--quiet' ]]; then
        _bashy_quiet=1
        shift
    fi

    if (( $# != 2 )); then
        if (( !_bashy_quiet )); then
            local msg
            if (( $# < 2 )); then
                msg='Missing argument(s)'
            else
                msg='Too many arguments'
            fi
            error-msg --file-line=1 "${msg}"' to `set-array-from-vals`.'
        fi
        return 1
    fi

    local _bashy_name="$1"
    local _bashy_origValue="$2"

    local _bashy_value="${_bashy_origValue}"
    local _bashy_notsp=$'[^ \n\r\t]' # Regex constant.
    local _bashy_space=$'[ \n\r\t]'  # Ditto.

    # Trim _ending_ whitespace, and prefix `value` with a space, the latter to
    # maintain the constraint that values are whitespace-separated.
    if [[ ${_bashy_value} =~ ^(.*${bashy_notsp})${_bashy_space}+$ ]]; then
        _bashy_value=" ${BASH_REMATCH[1]}"
    else
        _bashy_value=" ${_bashy_value}"
    fi

    local _bashy_values=() _bashy_print
    while [[ ${_bashy_value} =~ ^${_bashy_space}+(${bashy_notsp}.*)$ ]]; do
        _bashy_value="${BASH_REMATCH[1]}"
        if [[ ${_bashy_value} =~ ^([-+=_:./%@a-zA-Z0-9]+)(.*)$ ]]; then
            _bashy_values+=("${BASH_REMATCH[1]}")
            _bashy_value="${BASH_REMATCH[2]}"
        elif [[ ${_bashy_value} =~ ^(\'[^\']*\')(.*)$ ]]; then
            _bashy_values+=("${BASH_REMATCH[1]}")
            _bashy_value="${BASH_REMATCH[2]}"
        elif [[ ${_bashy_value} =~ ^\"([^\"]*)\"(.*)$ ]]; then
            printf -v _bashy_print '%q' "${BASH_REMATCH[1]}"
            _bashy_values+=("${_bashy_print}")
            _bashy_value="${BASH_REMATCH[2]}"
        elif [[ ${_bashy_value} =~ ^(\$\'([^\'\\]|\\.)*\')(.*)$ ]]; then
            _bashy_values+=("${BASH_REMATCH[1]}")
            _bashy_value="${BASH_REMATCH[3]}"
        fi
    done

    if ! [[ ${_bashy_value} =~ ^${_bashy_space}*$ ]]; then
        if (( !_bashy_quiet )); then
            error-msg 'Invalid `vals`-style multi-value string:'
            error-msg "  $(vals "${_bashy_origValue}")"
        fi
        return 1
    fi

    eval "${_bashy_name}=("${_bashy_values[@]}")"
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

# Helper for passing multiple values to multi-value options (`--name[]=...`),
# which formats its arguments so that the argument processor can recover the
# original multiple values. This works for any number of values including zero
# or one. Use it like `cmd --opt-name[]="$(vals -- ...)"`, or, more specifically
# when you want to pass an array, like `cmd --opt-name[]="$(vals --
# "${arrayName[@]}")"`. With option --dollar, _only_ uses dollar-quoting
# (`$'...'`).
function vals {
    local justDollar=0
    while (( $# > 0 )); do
        if [[ $1 == --dollar ]]; then
            justDollar=1
            shift
        elif [[ $1 == -- ]]; then
            shift
            break
        else
            break
        fi
    done

    if (( $# == 0 )); then
        return
    fi

    local v space=''
    for v in "$@"; do
        if (( !justDollar )) && [[ ${v} =~ ^[-+=_:./%@a-zA-Z0-9]+$ ]]; then
            printf $'%s%s' "${space}" "${v}"
        elif (( !justDollar )) && ! [[ ${v} =~ [$'\'\n\r\t'] ]]; then
            printf $'%s\'%s\'' "${space}" "${v}"
        else
            local newv=''
            while [[ ${v} != '' ]]; do
                if [[ ${v} =~ ^([^$'\\\'\n\r\t']+)(.*)$ ]]; then
                    newv+="${BASH_REMATCH[1]}"
                    v="${BASH_REMATCH[2]}"
                else
                    case "${v:0:1}" in
                        $'\\'|$'\'') newv+=$'\\'"${v:0:1}" ;;
                        $'\n')       newv+=$'\\n'          ;;
                        $'\r')       newv+=$'\\r'          ;;
                        $'\t')       newv+=$'\\t'          ;;
                    esac
                    v="${v:1}"
                fi
            done
            printf $'%s$\'%s\'' "${space}" "${newv}"
        fi
        space=' '
    done

    printf $'\n'
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
