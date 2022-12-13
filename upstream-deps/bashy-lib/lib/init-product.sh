# Copyright 2022 the Bashy-lib Authors (Dan Bornstein et alia).
# Licensed AS IS and WITHOUT WARRANTY under the Apache License, Version 2.0.
# Details: <http://www.apache.org/licenses/LICENSE-2.0>

#
# Per-product definitions needed by the product-agnostic top-level library
# initialization script `init.sh`
#

#
# Sibling libraries
#

##### LOAD ANY NEEDED LIBRARIES HERE! #####
# . "${_init_libDir}/some-lib.sh" || return "$?"


#
# Library functions
#

# Gets the name of this product (or "product").
function _init_product-name {
    echo 'unnamed-product'
}

# Performs any prerequisite checks needed by this product.
function _init_check-prerequisites {
    local error=0

    echo 1>&2 'No prerequisites defined!'
    error=1

    return "${error}"
}
