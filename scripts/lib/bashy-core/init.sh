# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Main initialization for Bashy-lib.
#

#
# Global setup
#

if [[ ${_init_libDir} != '' ]]; then
    error-msg "Warning: Not reinitializing library: ${_init_libDir##*/}"
    return 1
fi

# The symlink-resolved directory of this script.
_init_libDir="$(readlink -f "${BASH_SOURCE[0]}")" || return "$?"
_init_libDir="${_init_libDir%/*}"

# The symlink-resolved path of the command that is running (that is, the
# top-level script), and its directory.
_init_cmdPath="$(readlink -f "$0")" || return "$?"
_init_cmdDir="${_init_cmdPath%/*}"

# Load the core library's "built-in" functions.
. "${_init_libDir}/stderr-messages.sh" || return "$?"
. "${_init_libDir}/arg-processor.sh" || return "$?"

# TODO!
