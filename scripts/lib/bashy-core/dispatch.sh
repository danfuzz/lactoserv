# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Script dispatch helper. This is included by exposed scripts (e.g., directly
# under the `scripts` directory), to implement dispatch to sub-library scripts.
#

# The directory holding all sub-libraries.
_dispatch_libDir="${_bashy_dir%/*}"

# List of all sub-library directories. Initialized lazily.
_dispatch_libNames=()


#
# Public functions
#

# Includes (sources) a library file with the given name. (`.sh` is appended to
# the name to produce the actual name of the library file.) A file with this
# name must exist at the top level of a sublibrary directory.
function include-lib {
    _dispatch_initLibNames || return "$?"

    if (( $# == 0 )); then
        error-msg 'Missing library name.'
        return 1
    fi

    local incName="$1"

    if ! _dispatch_is-valid-name "${incName}"; then
        error-msg "include-lib: Invalid library name: ${incName}"
        return 1
    fi

    incName+='.sh'

    local libDir
    for libDir in "${libDirs[@]}"; do
        local path="${libDir}/${incName}"
        if [[ -f ${path} ]]; then
            # Use a variable name unlikely to conflict with whatever is loaded,
            # and then unset all the other locals before sourcing the script.
            local _dispatch_path="${path}"
            unset incName libDir path
            . "${_dispatch_path}" "$@"
            return "$?"
        fi
    done

    error-msg "include-lib: Not found: ${incName}"
    return 1
}

# Calls through to an arbitrary library command. Options:
# * `--libs=<names>` -- List simple names (not paths) of the sublibraries to
#   search. Without this, all sublibraries are searched.
# * `--path` -- Prints the path of the script instead of running it.
# * `--quiet` -- Does not print error messages.
function lib {
    _dispatch_initLibNames || return "$?"

    local wantPath=0
    local quiet=0
    local libs=''

    while true; do
        case "$1" in
            --libs=*) libs="${1#*=}"; shift ;;
            --path)   wantPath=1;     shift ;;
            --quiet)  quiet=1;        shift ;;
            *)        break                 ;;
        esac
    done

    if (( $# == 0 )); then
        error-msg 'lib: Missing command name.'
        return 1
    fi

    # These are the "arguments" / "returns" for the call to `_dispatch_find`.
    local beQuiet="${quiet}"
    local libNames=("${_dispatch_libNames[@]}")
    local args=("$@")
    local path=''
    local cmdName=''
    local libNames

    if [[ ${libs} == '' ]]; then
        libNames=("${_dispatch_libNames[@]}")
    else
        libNames=(${libs})
    fi

    _dispatch_find || return "$?"

    if (( wantPath )); then
        echo "${path}"
    else
        "${path}" --bashy-dispatched="${cmdName}" "${args[@]}"
    fi
}

# Performs dispatch. Accepts any number of sub-library names as arguments,
# followed by the argument `--` and then the script name, options, and arguments
# to run. The script name is looked up in the sub-libraries, and if something
# matching is found, it is dispatched to. The sub-libraries are searched in the
# order given.
#
# A "script name" does not have to be a single word: Sub-libraries can define
# a command hierarchy via directories named as if they were scripts. Each such
# directory can contain multiple scripts _or_ further script directories. In
# addition, each such directory must define a script called literally `_run`, to
# be run if no further sub-commands are listed on the original commandline.
function lib-dispatch {
    local libDirs=()
    while (( $# > 0 )); do
        if [[ $1 == '--' ]]; then
            shift
            break
        fi
        libDirs+=("${_dispatch_libDir}/$1")
        shift
    done

    if (( $# == 0 )); then
        error-msg 'Missing subcommand name.'
        return 1
    fi

    local cmdName="$1"

    local libDir path
    for libDir in "${libDirs[@]}"; do
        path="${libDir}/${cmdName}"
        if [[ -x ${path} ]]; then
            _dispatch_dispatch-in-dir "${libDir}" "$@"
            return "$?"
        fi
    done

    error-msg "Subcommand not found: ${cmdName}"
    return 1
}


#
# Library-internal functions
#

# Performs dispatch in the given directory.
function _dispatch_dispatch-in-dir {
    local libDir="$1"
    local cmdName="$2"
    shift 2

    local cmdWords=("${cmdName}")
    local path="${libDir}/${cmdName}"

    while true; do
        if [[ ! -x "${path}" ]]; then
            # Error: We landed at a non-exsitent path, unexecutable file, or
            # unsearchable directory.
            break
        elif [[ -f ${path} ]]; then
            _dispatch_run-script "${path}" "${cmdWords[*]}" "$@"
            return "$?"
        elif [[ -d ${path} ]]; then
            local subCmdName="$1"
            local subPath="${path}/${subCmdName}"
            if _dispatch_is-valid-name "${subCmdName}" && [[ -x "${subPath}" ]]; then
                # The next word is a valid next subcommand. Iterate.
                shift
                cmdWords+=("${subCmdName}")
                path="${subPath}"
            elif [[ -f "${path}/_run" && -x "${path}/_run" ]]; then
                # The next word isn't a subcommand name, but there's a `_run`
                # in the innermost subcommand directory. Run it.
                _dispatch_run-script "${path}/_run" "${cmdWords[*]}" "$@"
            else
                # Error: The next word isn't a subcommand name, and there's no
                # `default` to fall back on.
                cmdWords+=("${subCmdName}")
                break
            fi
        else
            # Error: We landed at a special file (device, etc.).
            break
        fi
    done

    error-msg "Subcommand not found: ${cmdWords[*]}"
    return 1
}

# Finds the named library script, based on the given commandline arguments. This
# uses variables to communicate with its caller (both for efficiency and
# specifically because there's no saner way to pass arrays back and forth):
#
# * `beQuiet` input -- Boolean, whether to suppress error messages.
# * `libNames` input -- An array which names all of the sublibraries to search
#   (just simple names, not paths).
# * `args` input/output -- An array of the base command name and all of the
#   arguments. It is updated to remove all of the words that name the command
#   (including subcommands) that was found.
# * `path` output -- Set to indicate the path of the command that was found.
# * `cmdName` output -- Name of the command that was found. This is a
#   space-separated lists of the words of the command and subcommand(s).
function _dispatch_find {
    if (( ${#args[@]} == 0 )); then
        if (( !beQuiet )); then
            error-msg 'lib: Missing command name.'
        fi
        return 1
    elif ! _dispatch_is-valid-name "${args[0]}"; then
        if (( !beQuiet )); then
            error-msg "lib: Invalid command name: ${args[0]}"
        fi
        return 1
    fi

    local d
    for d in "${libNames[@]}"; do
        _dispatch_find-in-dir "${d}" \
        && return
    done

    if (( !beQuiet )); then
        error-msg "lib: Command not found: ${args[0]}"
    fi
    return 1
}

# Helper for `_dispatch_find`, which does lookup of a command or subcommand
# within a specific directory. Inputs and outputs are as with `_dispatch_find`,
# except this also takes a regular argument indicating the path to the directory
# in which to perform the lookup. Returns non-zero without any message if the
# command was not found.
function _dispatch_find-in-dir {
    local libDir="$1"

    cmdName=''                    # Not `local`: This is returned to the caller.
    path="${_dispatch_libDir}/${libDir}" # Ditto.

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
            cmdName+=" ${nextWord}"
            path="${nextPath}"
            (( at++ ))
            break
        elif [[ -f "${nextPath}/_run" && -x "${nextPath}/_run" ]]; then
            # We are looking at a valid subcommand directory. Include it in the
            # result, and iterate.
            cmdName+=" ${nextWord}"
            path="${nextPath}"
        else
            # End of search: We landed at a special file (device, etc.).
            break
        fi
    done

    if (( at == 0 )); then
        # Did not find a match at all.
        return 1
    fi

    # Delete the initial space from `cmdName`.
    cmdName="${cmdName:1}"

    # Delete the args that became the command/subcommand.
    args=("${args[@]:$at}")

    if [[ -d ${path} ]]; then
        # Append subcommand directory runner.
        path+='/_run'
    fi
}

# Initializes `_dispatch_libNames` if not already done.
function _dispatch_initLibNames {
    if (( ${#_dispatch_libNames[@]} != 0 )); then
        return
    fi

    local names && names=($(
        cd "${_dispatch_libDir}"
        find . -mindepth 1 -maxdepth 1 -type d \
        | awk -F/ '{ print $2; }' \
        | sort
    )) \
    || return "$?"

    _dispatch_libNames=("${names[@]}")
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

# Runs the indicated script.
function _dispatch_run-script {
    local path="$1"
    local cmdWords="$2"
    shift 2

    "${path}" --bashy-dispatched="$(this-cmd-name) ${cmdWords}" "$@"
}
