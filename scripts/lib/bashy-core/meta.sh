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

# The simple name of the command that is running (that is, the top-level
# script). This doesn't include the directory path of the script, but it _does_
# include the "subcommand path" of the script if it was run via the subcommand
# dispatch system. It is initialized lazily (see below).
_bashy_cmdName=''


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
# script that is running. If this command was initiated via a subcommand
# dispatch, then the result of this call is the space-separated list of the
# command and all subcommands.
#
# With `--set`, this sets the command name to the one given. This is useful for
# scripts that take on the identity of other commands.
function this-cmd-name {
    if [[ $1 == --set ]]; then
        _bashy_cmdName="$2"
        return
    elif [[ ${_bashy_cmdName} == '' ]]; then
        # First time this function has been called.
        local name="${_bashy_cmdPath}" # Start with the full command path.
        local len="${#_bashy_libDir}"
        if [[ ${_bashy_libDir} == ${name:0:$len} ]]; then
            # We are looking at a command run from this library...
            name="${name:$((len + 1))}" # Drop the library directory prefix.
            name="${name#*/}"           # Drop the sublibrary directory name.
            name="${name%/_run}"        # Drop trailing `/_run` (if present).
            name="${name//\// }"        # Replace slashes with spaces.
        else
            # All other cases, just use the simple script name.
            name="${name##*/}"
        fi
        _bashy_cmdName="${name}"
    fi

    echo "${_bashy_cmdName}"
}

# Gets the full path of this command, "this command" being the (outer) script
# that is running.
function this-cmd-path {
    echo "${_bashy_cmdPath}"
}
