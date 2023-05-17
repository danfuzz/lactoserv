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

# Interprets standardized (for this project) JSON "post-processing" arguments.
# This processes `stdin`. The arguments must start with `::`. After that are
# options and arguments just as with `json-val`, except `--input` is not
# accepted.
#
# As a convenience, if not passed any arguments at all (not even `::`), this
# just (re)formats `stdin` to `stdout` using `json-val`.
#
# Finally, if `--check` is passed as the first argument (before `::`), then the
# remaining arguments are checked for basic validity (though not guaranteed
# correctness).
function jpostproc {
    local outputStyle='json'
    local justCheck=0

    if [[ $1 == '--check' ]]; then
        justCheck=1
        shift
    fi

    if (( $# == 0 )); then
        if (( !justCheck )); then
            jval --input=read
        fi
        return
    elif [[ $1 != '::' ]]; then
        error-msg 'Post-processing arguments must start with `::`.'
        return 1
    fi

    shift

    while (( $# > 0 )); do
        case "$1" in
            --output=*)
                outputStyle="${1#*=}"
                if ! [[ "${outputStyle}" =~ ^(compact|json|lines|none|raw|words)$ ]]; then
                    error-msg "Invalid result output style: ${outputStyle}"
                    return 1
                fi
                ;;
            --)
                # Explicit end of options.
                shift
                break
                ;;
            -?*)
                error-msg "Unknown result option: $1"
                return 1
                ;;
            *)
                # Non-option argument.
                break
                ;;
        esac

        shift
    done

    if (( justCheck )); then
        return
    fi

    if (( $# == 0 )) && [[ ${outputStyle} == 'none' ]]; then
        # No need to run a nop-filter just to not produce output.
        return
    fi

    jval --input=read --output="${outputStyle}" -- "$@" \
    || {
        error-msg 'Trouble with post-processing.'
        return 1
    }
}
