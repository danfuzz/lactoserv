# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Prerequisite checks
#
# This performs all prerequisite checks for the entire library, if such checking
# can't be verified to have already been done, and then marks them done such
# that inner library calls can (usually) tell.
#

# Name of an environment variable to indicate that prerequisites have been
# checked for this specific library, using a hash of the path to the
# sublibraries directory as the "key."
_prereqs_envVarName="$(
    printf 'BASHY_PREREQS_CHECKED_'
    if which shasum >/dev/null 2>&1; then
        # Darwin (macOS).
        shasum --algorithm=256
    else
        sha256sum
    fi \
    <<<"${_bashy_libDir}" \
    | cut -c 1-32
)"

if [[ ${!_prereqs_envVarName} =~ ^(running|done)$ ]]; then
    # Prerequisites are either already done or are currently in-progress. So,
    # don't redo the checks.
    return
fi

# Set the environment variable, so that inner library calls can see that the
# checks are now in-progress.
declare "${_prereqs_envVarName}=running"
export "${_prereqs_envVarName}"

# Run all the sublibrary prerequisites.
function _prereqs_run {
    local name
    for name in "${_bashy_libNames[@]}"; do
        local path="${_bashy_libDir}/${name}/_prereqs"
        if [[ -x ${path} && -f ${path} ]];then
            "${path}" || return "$?"
        fi
    done
}
_prereqs_run && unset -f _prereqs_run \
|| return "$?"

# Set the environment variable, so that inner library calls can see that the
# checks have completed successfully.
declare "${_prereqs_envVarName}=done"
