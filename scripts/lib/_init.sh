# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Main library initialization file.
#

. "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/bashy-core/init.sh" \
|| return "$?"

# Indicate that the base directory of this project is two layers up from this
# file.
base-dir --set=../..
