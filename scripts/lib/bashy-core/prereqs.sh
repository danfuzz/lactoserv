# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Prerequisite checks
#
# This performs any prerequisite checks for the entire library, that can't be
# verified to have been done, and then marks them done such that inner library
# calls can (usually) tell.
#

# TODO

# Something like:
# prereqEnvName: make env var name based on absolute path.
# check prereqEnvName for a "done" value. if done, stop.
# _dispatch_initLibNames
# iterate over libNames:
#   if base/name/_prereq is a script, then run it.
# set prereqEnvName to "done"
