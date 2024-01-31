# Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Per-unit initialization
#
# This runs the environment setup script for all units, including running
# prerequisite checks if they cannot be verified to have already been done.
# (Prerequisite doneness is checked via an environment variable, so that inner
# library calls can typically tell and avoid redoing them.)
#


#
# Global variables
#

# Name of an environment variable to indicate that prerequisites have been
# checked for this specific library, using a hash of the path to the `lib`
# directory as the "key." Note: This handles both common ways to get a SHA-256.
_bashy_prereqsEnvVarName="$(
    sha256sum <<<"${_bashy_libDir}" 2>/dev/null \
    || shasum --algorithm=256 <<<"${_bashy_libDir}" 2>/dev/null
)" || {
    error-msg 'Could not create prereqs environment variable name!'
    exit 1
}
_bashy_prereqsEnvVarName="BASHY_PREREQS_CHECKED_${_bashy_prereqsEnvVarName:0:32}"
export "${_bashy_prereqsEnvVarName}"


#
# Main script
#

# Load (source) all the setup scripts.
function _setup_load-all {
    local name
    for name in "${_bashy_unitNames[@]}"; do
        local path="${_bashy_libDir}/${name}/_setup.sh"
        if [[ -f ${path} ]]; then
            . "${path}" || return "$?"
        fi
    done
}
_setup_load-all && unset -f _setup_load-all \
|| return "$?"

# Handle prerequisite checks.
function _setup_check-prereqs {
    if [[ ${!_bashy_prereqsEnvVarName} =~ ^(running|done)$ ]]; then
        # Prerequisite checks are either already done or are currently
        # in-progress. So, don't redo the checks.
        return
    fi

    # Set the environment variable, so that inner library calls can see that the
    # checks are now in-progress. Note: `eval` is required for Bash-3.2
    # compatibility. (`declare -g -n` would work on later versions.)
    eval "${_bashy_prereqsEnvVarName}=running"

    # Run all the units' prerequisite checks.
    local name
    for name in "${_bashy_unitNames[@]}"; do
        local path="${_bashy_libDir}/${name}/_prereqs"
        if [[ -x ${path} && -f ${path} ]]; then
            "${path}" || return "$?"
        fi
    done

    # Set the environment variable, so that inner library calls can see that the
    # checks have completed successfully.
    eval "${_bashy_prereqsEnvVarName}=done"
}
_setup_check-prereqs && unset -f _setup_check-prereqs \
|| return "$?"
