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
# --file-line=<depth> -- Include the caller's file and line number, at the
#   indicated stack depth up from the caller, with `0` being the caller. That
#   is, a user of the command can use this to refer to what called it.
# --set=0|1 -- Enable or disable printing of this kind of message.
# --status -- Prints `1` or `0` to stdout, to indicate enabled status. (This is
#   to make it easy to propagate the enabled state down into another command.)
#


#
# Global variable setup
#

# Has an error been emitted?
_stderr_anyErrors=0

# Whether error messages are enabled.
_stderr_errorEnabled=1

# Whether info messages are enabled.
_stderr_infoEnabled=1

# Whether progress messages are enabled.
_stderr_progressEnabled=1


#
# Library functions
#

# Prints an error message to stderr, if such are enabled. **Note:** Error
# messages are _enabled_ by default.
function error-msg {
    _stderr_print-handler '_stderr_errorEnabled' '_stderr_anyErrors' "$@"
}

# Prints an info or warning message to stderr, if such are enabled. **Note:**
# Info messages are _enabled_ by default.
function info-msg {
    _stderr_print-handler '_stderr_infoEnabled' '' "$@"
}

# Prints a progress message to stderr, if such are enabled. **Note:** Progress
# messages are _enabled_ by default.
function progress-msg {
    _stderr_print-handler '_stderr_progressEnabled' '' "$@"
}

# Prints an option which reasonably approximates the current stderr settings.
# Specifically, it prints `--verbose=<level>` with the most detailed <level>
# currently enabled.
function stderr-opt {
    printf '%s' '--verbose='

    if (( _stderr_progressEnabled )); then
        echo 'all'
    elif (( _stderr_infoEnabled )); then
        echo 'warn'
    elif (( _stderr_errorEnabled )); then
        echo 'error'
    else
        echo 'none'
    fi
}

# Adds the usual stderr-control options.
# * `--verbose=<level>` -- Indicates which kinds of messages will pass. From
#   least to most:
#   * `none` -- None.
#   * `error` -- Just errors.
#   * `warn` -- Warning and informational messages.
#   * `all` -- Everything.
# * `--quiet` / `-q` -- Same as `--verbose=none`
function usual-stderr-args {
    opt-value --call=_stderr_verbose --enum='none error warn all' verbose
    opt-alias quiet/q --verbose=none
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
    local fileLineDepth=-1
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
            --file-line=*)
                fileLineDepth="${1#*=}"
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

    local didPrintName=0
    if [[ ${anyMessagesVarName} != '' ]] && (( !${!anyMessagesVarName} )); then
        if (( printName )); then
            didPrintName=1
            printf 1>&2 '%s: ' "$(this-cmd-name)"
        fi
        eval "${anyMessagesVarName}=1"
    fi

    if (( fileLineDepth >= 0 )); then
        if (( didPrintName )); then
            printf 1>&2 '\n'
        fi
        # `+ 1` because there's an internal caller layer to elide.
        [[ "$(caller "$((fileLineDepth + 1))")" =~ ^([0-9]+).*/(.*)$ ]]
        printf 1>&2 '%s:%s: ' "${BASH_REMATCH[2]}" "${BASH_REMATCH[1]}"
    fi

    if (( doExec )); then
        "$@" 1>&2
    else
        # `printf` to avoid option-parsing weirdness with `echo`.
        printf 1>&2 '%s\n' "$*"
    fi
}

# Handles the options `--quiet` and `--verbose`.
function _stderr_verbose {
    local level="$1"

    case "${level}" in
        none)
            error-msg --disable
            info-msg --disable
            progress-msg --disable
            ;;
        error)
            error-msg --enable
            info-msg --disable
            progress-msg --disable
            ;;
        warn)
            error-msg --enable
            info-msg --enable
            progress-msg --disable
            ;;
        all)
            error-msg --enable
            info-msg --enable
            progress-msg --enable
            ;;
    esac
}
