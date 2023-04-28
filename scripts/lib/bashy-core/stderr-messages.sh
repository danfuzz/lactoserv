# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Library for more palatable printing of stuff to stderr.
#
# Each of the functions in this library is meant to be used for a different
# printing "purpose:"
#
# * `error-msg` -- hard errors (that will result in a non-zero exit).
# * `info-msg` -- one-off requested information.
# * `progress-msg` -- progress messages.
#
# The functions all take the following options:
#
# --disable / --enable -- Alias for `--set=0` / `--set=1`, to read a bit better
#   when "manually" turning on or off messages.
# --exec -- Execute the arguments as a command, instead of treating them as
#   arguments to print. The command's output gets redirected to `stderr`.
# --set=0|1 -- Enable or disable printing of this kind of message.
# --status -- Prints `1` or `0` to stdout, to indicate enabled status. (This is
#   to make it easy to propagate the enabled state down into another command.)
#

#
# Global variable setup
#

# Symlink-resolved command name (not of this file, but our top-level includer).
_stderr_cmdName="$(readlink -f "$0")" || return "$?"
_stderr_cmdName="${_stderr_cmdName##*/}"

# Has an error been emitted?
_stderr_anyErrors=0

# Whether error messages are enabled.
_stderr_errorEnabled=1

# Whether info messages are enabled.
_stderr_infoEnabled=1

# Whether progress messages are enabled.
_stderr_progressEnabled=0


#
# Library functions
#

# Prints an error message to stderr, if such are enabled. **Note:** Error
# messages are _enabled_ by default.
function error-msg {
    _stderr_print-handler '_stderr_errorEnabled' '_stderr_anyErrors' "$@"
}

# Prints an info message to stderr, if such are enabled. **Note:** Info
# messages are _enabled_ by default.
function info-msg {
    _stderr_print-handler '_stderr_infoEnabled' '' "$@"
}

# Prints a progress message to stderr, if such are enabled. **Note:** Progress
# messages are _disabled_ by default.
function progress-msg {
    _stderr_print-handler '_stderr_progressEnabled' '' "$@"
}


#
# Internal functions
#

# Common code for the message-printers.
function _stderr_print-handler {
    local enabledVarName="$1"
    local anyMessagesVarName="$2"
    shift 2

    local doExec=0
    local printName=1
    local wasCmd=0

    while [[ $1 =~ ^-- ]]; do
        case "$1" in
            --disable|--set=0)
                eval "${enabledVarName}=0"
                wasCmd=1
                ;;
            --enable|--set=1)
                eval "${enabledVarName}=1"
                wasCmd=1
                ;;
            --exec)
                doExec=1
                ;;
            --no-name)
                if [[ ${anyMessagesVarName} == '' ]]; then
                    error-msg "Unrecognized option: $1"
                    return 1
                fi
                printName=0
                ;;
            --status)
                echo "${!enabledVarName}"
                wasCmd=1
                ;;
            --)
                shift
                break
                ;;
            *)
                error-msg "Unrecognized option: $1"
                return 1
                ;;
        esac
        shift
    done

    if (( wasCmd || !${!enabledVarName} )); then
        return
    fi

    if [[ ${anyMessagesVarName} != '' ]] && (( !${!anyMessagesVarName} )); then
        if (( printName )); then
            printf 1>&2 '%s: ' "${_stderr_cmdName}"
        fi
        eval "${anyMessagesVarName}=1"
    fi

    if (( doExec )); then
        "$@" 1>&2
    else
        # `printf` to avoid option-parsing weirdness with `echo`.
        printf 1>&2 '%s\n' "$*"
    fi
}
