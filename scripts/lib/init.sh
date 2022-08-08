# Copyright 2022 Dan Bornstein. All rights reserved.
# All code and assets are considered proprietary and unlicensed.

if [[ ${_sites_libDir} != '' ]]; then
    error-msg 'Warning: Not reinitializing library!'
    return 1
fi

#
# Global variable setup
#

# Environment variable prefix, to (try to) avoid clashes with other uses of
# similar scripts.
_init_envVarPrefix='_MILK_SITES'

# The symlink-resolved path of the command that is running (that is, the
# top-level script).
_init_cmdPath="$(readlink -f "$0")" || return "$?"

# Figure out the symlink-resolved directory of this script.
_init_libDir="$(readlink -f "${BASH_SOURCE[0]}")" || return "$?"
_init_libDir="${_init_libDir%/*}"

# Figure out the "main" directory. If `cmdDir` is the same as `libDir`, then
# we're running a library script, and the main directory is the parent of
# `libDir`. Otherwise, the main directory is `cmdDir`.
if [[ ${_init_cmdDir} == ${_init_libDir} ]]; then
    _init_mainDir="$(cd "${_init_libDir}/.."; /bin/pwd)"
else
    _init_mainDir="${_init_cmdPath%/*}"
fi


#
# Sibling libararies
#

. "${_init_libDir}/stderr-messages.sh"  # Error and progress messages.
. "${_init_libDir}/arg-processor.sh"    # Argument processor.


#
# Prerequisites checker
#
# This is arranged to only do prerequisite checks once per high-level script
# call, instead of re-re-...-doing it multiple times.
#

_init_envVarName="${_init_envVarPrefix}_PREREQUISITES_DONE"
if [[ ${!_init_envVarName} != 1 ]]; then
    . "${_init_libDir}/init-check-prereqs.sh" \
    || {
        error-msg 'Failed one or more prerequisite checks!'
        return 1
    }

    eval "export ${_init_envVarName}=1"
fi


#
# More library functions
#

# Gets the directory of this command, "this command" being the main script that
# is running.
function this-cmd-dir {
    echo "${_init_cmdPath%/*}"
}

# Gets the name of this command, that is, "this command" being the main script
# that is running.
function this-cmd-name {
    echo "${_init_cmdPath##*/}"
}

# Gets the full path of this command, "this command" being the main script that
# is running.
function this-cmd-path {
    echo "${_init_cmdPath}"
}

# Calls through to an arbitrary library script.
function lib {
    if (( $# == 0 )); then
        error-msg 'Missing library script name.'
        return 1
    fi

    local name="$1"
    shift

    if ! [[ ${name} =~ ^[-a-z]+$ ]]; then
        error-msg 'Weird script name:' "${name}"
        return 1
    elif [[ -x "${_init_libDir}/${name}" ]]; then
        # It's in the internal helper library.
        "${_init_libDir}/${name}" "$@"
    elif [[ -x "${_init_mainDir}/${name}" ]]; then
        # It's an exposed script.
        "${_init_mainDir}/${name}" "$@"
    else
        error-msg 'No such library script:' "${name}"
        return 1
    fi
}
