# Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

# "Meta-ubik" function for interactive (human-driven) usage. Define this in your
# interactive shell, and `ubik ...` will attempt to find the "nearest" directory
# above the CWD containing either `scripts/ubik` or `bin/ubik`, and then call
# _that_ `ubik`. If not found at or above the CWD, it will use an `ubik` in
# `PATH` if any.
function ubik {
    local ubikPath

    ubikPath="$(
        while [[ ${PWD} != '/' ]]; do
            [[ -x scripts/ubik ]] && echo "${PWD}/scripts/ubik" && exit
            [[ -x bin/ubik ]] && echo "${PWD}/bin/ubik" && exit
            cd ..
        done
        which 2>/dev/null ubik
    )" \
    || {
        echo 1>&2 'ubik (interactive):'
        echo 1>&2 '  No `ubik` script found in/above current directory or in PATH.'
        return 127
    }

    "${ubikPath}" "$@"
}
