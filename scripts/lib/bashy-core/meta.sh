# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Library for meta-operations on Bashy-lib
#


#
# Global variable setup
#

# Base directory of the project. This must be set by the project-specific
# init file.
_bashy_baseDir=''

# Current subproject directory. This must be set by the subproject-specific
# init file.
_bashy_subprojectDir=''


#
# Library functions
#

# Gets the base directory of the project. With `--set=`, sets it to the given
# directory, which can be specified relative to the calling script. It is an
# error to try to get the directory before having set it.
function base-dir {
    if [[ $1 =~ --set=(.*)$ ]]; then
        local setDir="${BASH_REMATCH[1]}"
        if [[ ${setDir} =~ [^/] ]]; then
            local callerDir="$(dirname "$(readlink -f "${BASH_SOURCE[1]}")")"
            setDir="${callerDir}/${setDir}"
        fi
        _bashy_baseDir="$(readlink -f "${setDir}")"
    elif [[ ${_bashy_baseDir} == '' ]]; then
        error-msg 'Base directory not set. (Use `base-dir --set` in your project'
        error-msg 'init file.)'
        return 1
    else
        echo "${_bashy_baseDir}"
    fi
}

# Gets the current subproject directory. With `--set=`, sets it to the given
# directory, which can be specified relative to the calling script. It is an
# error to try to get the directory before having set it.
function subproject-dir {
    if [[ $1 =~ --set=(.*)$ ]]; then
        local setDir="${BASH_REMATCH[1]}"
        if [[ ${setDir} =~ [^/] ]]; then
            local callerDir="$(dirname "$(readlink -f "${BASH_SOURCE[1]}")")"
            setDir="${callerDir}/${setDir}"
        fi
        _bashy_subprojectDir="$(readlink -f "${setDir}")"
    elif [[ ${_bashy_subprojectDir} == '' ]]; then
        error-msg 'Subproject directory not set. (Use `subproject-dir --set` in'
        error-msg 'your subproject init file.)'
        return 1
    else
        echo "${_bashy_subprojectDir}"
    fi
}

# Gets the subproject name (the simple name of the subproject directory). It is
# an error to use this before the subproject directory has been set.
function subproject-name {
    local dir && dir="$(subproject-dir)" || return "$?"

    echo "${dir##*/}"
}

# Gets the directory of this command, "this command" being the (outer) script
# that is running.
function this-cmd-dir {
    echo "${_bashy_cmdPath%/*}"
}

# Gets the name of this command, that is, "this command" being the (outer)
# script that is running.
function this-cmd-name {
    echo "${_bashy_cmdPath##*/}"
}

# Gets the full path of this command, "this command" being the (outer) script
# that is running.
function this-cmd-path {
    echo "${_bashy_cmdPath}"
}
