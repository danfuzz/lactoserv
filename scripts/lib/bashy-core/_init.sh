# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Main entrypoint for Bashy-lib.
#


#
# Global setup
#

# Sanity check.
if [[ ${_bashy_dir} != '' ]]; then
    error-msg "Warning: Not reinitializing library: ${_bashy_dir##*/}"
    return 1
fi

# The symlink-resolved path of the command that is running (that is, the
# top-level script).
_bashy_cmdPath="$(readlink -f "$0")" || return "$?"

# The symlink-resolved directory of this script.
_bashy_dir="$(readlink -f "${BASH_SOURCE[0]}")" || return "$?"
_bashy_dir="${_bashy_dir%/*}"

# The directory holding all sub-libraries (including this one).
_bashy_libDir="${_bashy_dir%/*}"

# Load the core library's own sub-libraries. These all have no load-time
# dependencies.
. "${_bashy_dir}/arg-processor.sh" || return "$?"
. "${_bashy_dir}/dispatch.sh" || return "$?"
. "${_bashy_dir}/misc.sh" || return "$?"
. "${_bashy_dir}/meta.sh" || return "$?"
. "${_bashy_dir}/stderr-messages.sh" || return "$?"

# List of all sub-library directory names.
_bashy_unitNames=()
function _bashy_init-unit-names {
    local names=("${_bashy_libDir}"/*)
    local i
    for i in "${!names[@]}"; do
        if [[ -d ${names[i]} ]]; then
            names[i]="${names[i]##*/}"
        else
            unset names[i]
        fi
    done

    sort-array names
    _bashy_unitNames=("${names[@]}")
}
_bashy_init-unit-names && unset -f _bashy_init-unit-names \
|| return "$?"

# Perform setup for all units (including prerequisite checking). This has to be
# loaded after all the above; the custom unit bits are allowed to use any of it
# they want to.
. "${_bashy_dir}/setup.sh" || return "$?"
