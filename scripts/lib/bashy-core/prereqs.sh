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

if [[ ${!_prereqs_envVarName} == '1' ]]; then
    return
fi

# TODO: Run prerequisites.
# iterate over libNames:
#   if base/name/_prereq is a script, then run it.

# Set the environment variable, so that inner library calls can see that the
# checks have been done.
declare "${_prereqs_envVarName}=1"
export "${_prereqs_envVarName}"
