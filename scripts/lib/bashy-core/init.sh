# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Main initialization for Bashy-lib.
#

#
# Global setup
#

# Sanity check.
if [[ ${_bashy_libDir} != '' ]]; then
    error-msg "Warning: Not reinitializing library: ${_bashy_libDir##*/}"
    return 1
fi

# The symlink-resolved directory of this script.
_bashy_libDir="$(readlink -f "${BASH_SOURCE[0]}")" || return "$?"
_bashy_libDir="${_bashy_libDir%/*}"

# The symlink-resolved path of the command that is running (that is, the
# top-level script).
_bashy_cmdPath="$(readlink -f "$0")" || return "$?"

# Load the core library's own sub-libraries.
. "${_bashy_libDir}/meta.sh" || return "$?"
. "${_bashy_libDir}/stderr-messages.sh" || return "$?"
. "${_bashy_libDir}/arg-processor.sh" || return "$?"

# TODO: Library dispatch.
