# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

# "Meta-ubik" function for interactive (human-driven) usage. Define this in your
# interactive shell, and `ubik ...` will attempt to find the "nearest" directory
# above the CWD containing either `scripts/ubik` or `bin/ubik`, and then call
# _that_ `ubik`.
function ubik {
    local ubikPath

    ubikPath="$(
        while true; do
            [[ -x scripts/ubik ]] && echo "${PWD}/scripts/ubik" && break
            [[ -x bin/ubik ]] && echo "${PWD}/bin/ubik" && break
            cd ..
            [[ ${PWD} == '/' ]] && exit 1
        done
    )" \
    || {
        echo 1>&2 'ubik (interactive): No `ubik` script found to run in or above directory:'
        echo 1>&2 "  ${PWD}"
        return 127
    }

    "${ubikPath}" "$@"
}
