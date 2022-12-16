# Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
# All code and assets are considered proprietary and unlicensed.

#
# Per-product definitions needed by the product-agnostic top-level library
# initialization script `init.sh`
#

#
# Sibling libraries
#

. "${_init_libDir}/init-wrappers.sh" || return "$?"


#
# Helper functions
#

# Checks one dependency.
function check-dependency {
    local name="$1"
    local versionCmd="$2"
    local match="$3"
    local versionMsg="$4"

    # Extract just the binary (executable / command / tool) name.
    local cmdName=''
    if [[ ${versionCmd} =~ ^([^ ]+) ]]; then
        cmdName="${BASH_REMATCH[1]}"
    else
        # Note: This indicates a bug in this script, not a problem with the
        # environment.
        error-msg "Could not determine binary name for ${name}."
        return 1
    fi

    # Verify that the command exists at all.
    if ! which "${cmdName}" >/dev/null 2>&1; then
        error-msg "Missing required binary for ${name}: ${cmdName}"
        return 1
    fi

    local version
    version=$(eval "${versionCmd}") \
    || {
        # Note: This indicates a bug in this script, not a problem with the
        # environment.
        error-msg "Trouble running version command for ${name}."
        return 1
    }

    if [[ !(${version} =~ ${match}) ]]; then
        error-msg "Unsupported version of ${name}: ${version}"
        error-msg "  required version: ${versionMsg}"
        return 1
    fi
}


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

    check-dependency \
        'Node' \
        'node --version | sed -e "s/^v//"' \
        '^(18|19)\.' \
        '18 or 19' \
    || error=1

    check-dependency \
        'jq' \
        'jq --version | sed -e "s/^jq-//"' \
        '^1.6$' \
        '1.6' \
    || error=1

    return "${error}"
}
