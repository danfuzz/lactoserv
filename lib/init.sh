# Copyright 2022 the Bashy-lib Authors (Dan Bornstein et alia).
# Licensed AS IS and WITHOUT WARRANTY under the Apache License, Version 2.0.
# Details: <http://www.apache.org/licenses/LICENSE-2.0>

if [[ ${_init_libDir} != '' ]]; then
    error-msg 'Warning: Not reinitializing library!'
    return 1
fi

#
# Global setup
#

# The symlink-resolved path of the command that is running (that is, the
# top-level script), and its directory.
_init_cmdPath="$(readlink -f "$0")" || return "$?"
_init_cmdDir="${_init_cmdPath%/*}"

# Figure out the symlink-resolved directory of this script.
_init_libDir="$(readlink -f "${BASH_SOURCE[0]}")" || return "$?"
_init_libDir="${_init_libDir%/*}"

# Figure out the "scripts" and "base" directories, which are presumed to be one
# and two layers up (respectively) from the library directory (that is, the
# directory that this script is in).
_init_scriptsDir="${_init_libDir%/*}"
_init_baseDir="${_init_scriptsDir%/*}"

# Load the "built-in" core libraries.
. "${_init_libDir}/stderr-messages.sh" || return "$?"
. "${_init_libDir}/arg-processor.sh" || return "$?"

# Set up the library search paths (for the `lib` command), and define the
# lib-path-adder function, so that the product-specific init can use it.
_init_libSearchPaths=("${_init_scriptsDir}" "${_init_libDir}")
if [[ !(${_init_cmdDir} =~ ^("${_init_scriptsDir}"|"${_init_libDir}")$) ]]; then
    # The directory of the command that is running is not either the scripts or
    # library directory, so add it to the search path.
    _init_libSearchPaths+=(${_init_cmdDir})
fi
function add-lib {
    _init_libSearchPaths+=("${_init_libDir}/$1")
}

# Load product-specific initialization code (including loading other libraries).
. "${_init_libDir}/init-product.sh"


#
# Prerequisites checker
#
# This is arranged to only do prerequisite checks once per high-level script
# call, instead of re-re-...-doing it multiple times.
#

_init_envVarName="$(_init_product-name | tr a-z- A-Z_)_PREREQUISITES_DONE"
if [[ ${!_init_envVarName} != 1 ]]; then
    _init_check-prerequisites \
    || {
        error-msg
        error-msg 'Failed one or more prerequisite checks!'
        return 1
    }

    eval "export ${_init_envVarName}=1"
fi


#
# More library functions
#

# Gets the base directory of the project, which is presumed to be one layer up
# from the main scripts directory.
function base-dir {
    echo "${_init_baseDir}"
}

# Gets the directory of this command, "this command" being the (outer) script
# that is running.
function this-cmd-dir {
    echo "${_init_cmdDir}"
}

# Gets the name of this command, that is, "this command" being the (outer)
# script that is running.
function this-cmd-name {
    echo "${_init_cmdPath##*/}"
}

# Gets the full path of this command, "this command" being the (outer) script
# that is running.
function this-cmd-path {
    echo "${_init_cmdPath}"
}

# Calls through to an arbitrary library script. With option `--path`, instead
# prints the path of the script. With option `--quiet`, does not write an error
# message if there is no such script.
function lib {
    local wantPath=0
    local quiet=0

    while true; do
        case "$1" in
            --path)  wantPath=1; shift ;;
            --quiet) quiet=1;    shift ;;
            *)       break ;;
        esac
    done

    if (( $# == 0 )); then
        error-msg 'Missing library script name.'
        return 1
    fi

    local name="$1"
    shift

    if ! [[ ${name} =~ ^[-_a-z0-9]+$ ]]; then
        error-msg 'Weird script name:' "${name}"
        return 1
    fi

    local path
    for path in "${_init_libSearchPaths[@]}"; do
        path+="/${name}"
        if [[ -x "${path}" ]]; then
            break
        fi
        path=''
    done

    if [[ ${path} == '' ]]; then
        if (( !quiet )); then
            error-msg 'No such library script:' "${name}"
        fi
        return 1
    elif (( wantPath )); then
        echo "${path}"
    else
        "${path}" "$@"
    fi
}
