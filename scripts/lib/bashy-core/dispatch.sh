# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Script dispatch helper.
#
# Note that `lib` in particular is what is used by scripts to invoke other
# scripts, and can also be used as the main call to implement a top-level "run
# some subcommand" script (`lib --units=<my-project> "$@"`).
#


#
# Public functions
#

# Includes (sources) a library file with the given name. (`.sh` is appended to
# the name to produce the actual name of the library file.) A file with this
# name must exist at the top level of some unit directory. Additional arguments
# are passed to the included script and become available as `$1` etc.
#
# It is assumed that failure to load a library is a fatal problem. As such, if
# a library isn't found, the process will exit.
function include-lib {
    if (( $# == 0 )); then
        error-msg 'Missing library name.'
        exit 1
    fi

    local incName="$1"
    shift

    if ! _dispatch_is-valid-name "${incName}"; then
        error-msg "include-lib: Invalid library name: ${incName}"
        exit 1
    fi

    incName+='.sh'

    local d
    for d in "${_bashy_unitNames[@]}"; do
        local path="${_bashy_libDir}/${d}/${incName}"
        if [[ -f ${path} ]]; then
            # Use a variable name unlikely to conflict with whatever is loaded,
            # and then unset all the other locals before sourcing the script.
            local _dispatch_path="${path}"
            unset d incName path
            . "${_dispatch_path}" "$@" \
            && return \
            || exit "$?"
        fi
    done

    error-msg "include-lib: Not found: ${incName}"
    exit 1
}

# Calls through to an arbitrary library command. Options:
# * `--exec` -- `exec` the script instead of calling it in a subshell.
# * `--path` -- Prints the path of the script instead of running it. In the case
#   of a hierarchical (sub)command, this prints the directory (not the `_run`
#   script, if any).
# * `--quiet` -- Does not print error messages.
# * `--units=<names>` -- List simple names (not paths) of the units to search.
#   Without this, all units are searched.
#
# After the options, the next argument is taken to be a main command. After
# that, any number of subcommands are accepted as long as they are allowed by
# the main command. See the docs for more details on directory structure. TLDR:
# A subcommand is a directory with an optional `_run` script in it along with
# any number of other executable scripts or subcommand directories.
#
# As with running a normal shell command, if the command is not found (including
# if the name is invalid), this returns code `127`.
function lib {
    local doExec=0
    local wantPath=0
    local quiet=0
    local units=''

    while true; do
        case "$1" in
            --exec)    doExec=1;        shift ;;
            --path)    wantPath=1;      shift ;;
            --quiet)   quiet=1;         shift ;;
            --units=*) units="${1#*=}"; shift ;;
            *)        break                  ;;
        esac
    done

    if (( $# == 0 )); then
        error-msg 'lib: Missing command name.'
        return 127
    fi

    # These are the "arguments" / "returns" for the call to `_dispatch_find`.
    local beQuiet="${quiet}"
    local args=("$@")
    local unitNames=()
    local path=''

    if [[ ${units} == '' ]]; then
        unitNames=("${_bashy_unitNames[@]}")
    else
        unitNames=(${units})
    fi

    _dispatch_find || return "$?"

    if (( wantPath )); then
        if [[ ${args[0]} =~ ^--original-path=(.*)$ ]]; then
            echo "${BASH_REMATCH[1]}"
        else
            echo "${path}"
        fi
    elif (( doExec )); then
        exec "${path}" "${args[@]}"
    else
        "${path}" "${args[@]}"
    fi
}


#
# Library-internal functions
#

# Finds the named library script, based on the given commandline arguments. This
# uses variables to communicate with its caller (both for efficiency and
# specifically because there's no saner way to pass arrays back and forth):
#
# * `beQuiet` input -- Boolean, whether to suppress error messages.
# * `unitNames` input -- An array which names all of the units to search (just
#   simple names, not paths).
# * `args` input/output -- An array of the base command name and all of the
#   arguments. It is updated to remove all of the words that name the command
#   (including subcommands) that was found.
# * `path` output -- Set to indicate the path of the command that was found.
function _dispatch_find {
    if (( ${#args[@]} == 0 )); then
        if (( !beQuiet )); then
            error-msg 'lib: Missing command name.'
        fi
        return 127
    elif ! _dispatch_is-valid-name "${args[0]}"; then
        if (( !beQuiet )); then
            error-msg "lib: Invalid command name: ${args[0]}"
        fi
        return 127
    fi

    local d
    for d in "${unitNames[@]}"; do
        _dispatch_find-in-dir "${d}" \
        && return
    done

    if (( !beQuiet )); then
        error-msg "lib: Command not found: ${args[0]}"
    fi
    return 127
}

# Helper for `_dispatch_find`, which does lookup of a command or subcommand
# within a specific directory. Inputs and outputs are as with `_dispatch_find`,
# except this also takes a regular argument indicating the path to the directory
# in which to perform the lookup. Returns non-zero without any message if the
# command was not found.
function _dispatch_find-in-dir {
    local libDir="$1"

    # Not `local`: This is returned to the caller.
    path="${_bashy_libDir}/${libDir}"

    # Info about the deepest `_run` script found.
    local runAt=-1
    local runCmdName=''
    local runPath=''

    local at
    for (( at = 0; at < ${#args[@]}; at++ )); do
        local nextWord="${args[$at]}"
        local nextPath="${path}/${nextWord}"

        if ! _dispatch_is-valid-name "${nextWord}"; then
            # End of search: The next word is not a valid command name.
            break
        elif [[ ! -x ${nextPath} ]]; then
            # End of search: We landed at a non-exsitent path, unexecutable
            # file, or unsearchable directory.
            break
        elif [[ -f ${nextPath} ]]; then
            # We are looking at a regular executable script. Include it in the
            # result, and return it.
            path="${nextPath}"
            (( at++ ))
            break
        elif [[ -d "${nextPath}" ]]; then
            # We are looking at a subcommand directory. Include it in the
            # result, and iterate.
            path="${nextPath}"
            if [[ -f "${nextPath}/_run" && -x "${nextPath}/_run" ]]; then
                runAt="${at}"
                runCmdName="${runCmdName}"
                runPath="${path}/_run"
            fi
        else
            # End of search: We landed at a special file (device, etc.).
            break
        fi
    done

    if (( at == 0 )); then
        # Did not find a match at all.
        return 1
    fi

    if [[ -d ${path} ]]; then
        # We found a subcommand directory. Adjust to point at the deepest `_run`
        # script that was found (if any).
        if (( runAt == -1 )); then
            # Use the default run script, and augment `args` to have enough info
            # for the default runner to make sense of things.
            args=(--original-path="${path}" --original-command="${args[*]:0:$at}" "${args[@]}")
            path="${_bashy_dir}/_default-run"
        else
            # Use the runner that was found in the command, and augment `args`
            # so it can figure out how it was invoked.
            args=(--original-command="${args[*]:$runCmdAt:$at}" "${args[@]:$at}")
            at="${runCmdAt}"
            path="${runPath}"
        fi
    else
        # Delete the args that became the command/subcommand.
        args=("${args[@]:$at}")
    fi
}

# Indicates by return code whether the given name is a syntactically correct
# command / subcommand name, as far as this system is concerned.
function _dispatch_is-valid-name {
    local name="$1"

    if [[ ${name} =~ ^[_a-z][-_.:a-z0-9]+$ ]]; then
        return 0
    else
        return 1
    fi
}
