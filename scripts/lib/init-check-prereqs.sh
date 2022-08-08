# Copyright 2022 Dan Bornstein. All rights reserved.
# All code and assets are considered proprietary and unlicensed.

#
# Main script
#

# Do the checks. This is a function and not just top-level code, so we can avoid
# polluting the global variable namespace.
function check-prereqs {
    local error=0

    if ! which jq >/dev/null 2>&1; then
        error-msg 'Missing `jq` binary.'
        error=1
    fi

    if ! which node >/dev/null 2>&1; then
        error-msg 'Missing `node` binary.'
        error=1
    fi

    # TODO: Should probably do more stuff!

    return "${error}"
}

check-prereqs || return "$?"
unset -f check-prereqs # Leave no trace.
