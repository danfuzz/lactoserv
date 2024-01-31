# Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Main library initialization file.
#

. "${BASH_SOURCE[0]%/*}/bashy-core/_init.sh" || return "$?"

# Indicate that the base directory of this project is two layers up from this
# file.
base-dir --set=../..
