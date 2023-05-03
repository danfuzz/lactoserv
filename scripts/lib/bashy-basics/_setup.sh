#!/bin/bash
#
# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Setup for this unit.
#

# Calls `lib json-array`.
function jarray {
    lib json-array "$@"
}

# Calls `lib json-get`.
function jget {
    lib json-get "$@"
}

# Calls `lib json-length`.
function jlength {
    lib json-length "$@"
}

# Calls `lib json-val`.
function jval {
    lib json-val "$@"
}
