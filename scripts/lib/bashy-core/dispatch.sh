# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Script dispatch helper library. This is included by exposed scripts (e.g.,
# directly under the `scripts` directory), to implement dispatch to sub-library
# scripts.
#

# The symlink-resolved directory of this script.
_dispatch_dir="$(readlink -f "${BASH_SOURCE[0]}")" || return "$?"
_dispatch_dir="${_dispatch_dir%/*}"

# The directory holding all sub-libraries.
_dispatch_libDir="${_dispatch_dir%/*}"

. "${_dispatch_dir}/init.sh" || return "$?"


#
# Public functions
#

# Performs dispatch. Accepts any number of sub-library names as arguments,
# followed by the argument `--` and then the script name, options, and arguments
# to run. The script name is looked up in the sub-libraries, and if something
# matching is found, it is dispatched to. The sub-libraries are searched in the
# order given.
#
# A "script name" does not have to be a single word: Sub-libraries can define
# a command hierarchy via directories named as if they were scripts. Each such
# directory can contain multiple scripts _or_ further script directories. And
# each such directory may (but is not required to) define a script called
# literally `_run`, to run if no further sub-commands are listed on the original
# commandline.
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
            info-msg --exec printf '>>%q\n' "$@"
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
            if _dispatch_is-subcommand-name "${subCmdName}" && [[ -x "${subPath}" ]]; then
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

# Indicates by return code whether the given name is a syntactically correct
# command / subcommand name, as far as this system is concerned.
function _dispatch_is-subcommand-name {
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

    exec "${path}" --bashy-dispatched="$(this-cmd-name) ${cmdWords}" "$@"
}
