# Copyright 2022 Dan Bornstein. All rights reserved.
# All code and assets are considered proprietary and unlicensed.

#
# Per-product definitions needed by the product-agnostic top-level library
# initialization script `init.sh`
#

#
# Sibling libraries
#

. "${_init_libDir}/stderr-messages.sh" || return "$?"
. "${_init_libDir}/arg-processor.sh" || return "$?"


#
# Library functions
#

# Gets the name of this product (or "product").
function _init_product-name {
    echo 'milk-sites'
}

# Performs any prerequisite checks needed by this product.
function _init_check-prerequisites {
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
