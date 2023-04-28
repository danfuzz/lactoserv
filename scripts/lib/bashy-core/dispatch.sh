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

# This helper isn't loaded in the context of the full library, and so we need to
# our own sub-library inclusion.
. "${_dispatch_dir}/arg-processor.sh" || return "$?"
. "${_dispatch_dir}/stderr-messages.sh" || return "$?"


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
        info-msg '#### LOOKING FOR' "${path}"
        if [[ -x ${path} ]]; then
            info-msg '### DISPATCHING' ">>${libDir}<<"
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

    info-msg '##### LIB DIR' "${libDir}"
    info-msg '##### CMD NAME' ">>${cmdName}<<"
    info-msg '##### ARGS' "$@"

    local cmdWords=("${cmdName}")
    local path="${libDir}/${cmdName}"

    while true; do
        info-msg '#### LOOKING AT' "${path}"
        if [[ ! -x "${path}" ]]; then
            # Error: We landed at a non-exsitent path, unexecutable file, or
            # unsearchable directory.
            break
        elif [[ -f ${path} ]]; then
            _dispatch_run-script "${path}" "$@"
            return "$?"
        elif [[ -d ${path} ]]; then
            local subCmdName="$1"
            if [[ -x "${path}/${subCmdName}" ]]; then
                shift
                cmdWords+=("${subCmdName}")
                path+="/${subCmdName}"
            elif [[ -f "${path}/_run" && -x "${path}/_run" ]]; then
                # The next word isn't a subcommand name, but there's a `default`
                # in the innermost subcommand directory. Run it.
                _dispatch_run-script "${path}/_run" "$@"
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

# Runs the indicated script.
function _dispatch_run-script {
    local path="$1"
    shift

    exec "${path}" "$@"
}
