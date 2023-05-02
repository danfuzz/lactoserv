# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# This is an example subcommand initialization file.
#

. "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../init.sh" \
|| return "$?"
