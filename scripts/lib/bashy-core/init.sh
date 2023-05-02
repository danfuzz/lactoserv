# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Main initialization for Bashy-lib.
#


#
# Global setup
#

# Sanity check.
if [[ ${_bashy_dir} != '' ]]; then
    error-msg "Warning: Not reinitializing library: ${_bashy_dir##*/}"
    return 1
fi

# The symlink-resolved directory of this script.
_bashy_dir="$(readlink -f "${BASH_SOURCE[0]}")" || return "$?"
_bashy_dir="${_bashy_dir%/*}"

# The directory holding all sub-libraries (including this one).
_bashy_libDir="${_bashy_dir%/*}"

# List of all sub-library directory names.
_bashy_libNames=()
function _bashy_initLibNames {
    local names && names=($(
        cd "${_bashy_libDir}"
        find . -mindepth 1 -maxdepth 1 -type d \
        | awk -F/ '{ print $2; }' \
        | sort
    )) \
    || return "$?"

    _bashy_libNames=("${names[@]}")
}
_bashy_initLibNames && unset -f _bashy_initLibNames \
|| return "$?"

# The symlink-resolved path of the command that is running (that is, the
# top-level script).
_bashy_cmdPath="$(readlink -f "$0")" || return "$?"

# Load the core library's own sub-libraries.
. "${_bashy_dir}/arg-processor.sh" || return "$?"
. "${_bashy_dir}/dispatch.sh" || return "$?"
. "${_bashy_dir}/meta.sh" || return "$?"
. "${_bashy_dir}/misc.sh" || return "$?"
. "${_bashy_dir}/stderr-messages.sh" || return "$?"

# Perform sublibrary setup (including prerequisite checking). This has to be
# loaded after all the above; the custom sublibrary bits are allowed to use any
# of it they want to.
. "${_bashy_dir}/setup.sh" || return "$?"
