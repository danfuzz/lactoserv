#!/bin/bash
#
# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Setup for this unit.
#


#
# Shortened aliases.
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


#
# Other functions
#

# Where the `--output` option lands when parsed.
_bashy_jsonOutputStyle=

# Where JSON postprocessing arguments land when parsed.
_bashy_jsonPostArgs=()

# Checks JSON output and postprocessing arguments for sanity.
function check-json-output-args {
    if (( ${#_bashy_jsonPostArgs[@]} != 0 )); then
        if [[ ${_bashy_jsonOutputStyle} == 'none' ]]; then
            error-msg 'Cannot do post-processing given `--output=none`.'
            usage --short
            return 1
        fi

        jpostproc --check "${_bashy_jsonPostArgs[@]}" \
        || {
            usage --short
            return 1
        }
    fi
}

# Converts a JSON array to a Bash array of elements. Stores into the named
# variable. With option `--lenient`, treats a non-array as a single-element
# array.
function jbash-array {
    # Note: Because we use `eval`, local variables are given name prefixes to
    # avoid conflicts with the caller.

    local _bashy_lenient=0
    if [[ $1 == --lenient ]]; then
        _bashy_lenient=1
        shift
    fi

    local _bashy_name="$1"
    local _bashy_value="$2"

    # `--output=compact` guarantees an element per line.
    if (( _bashy_lenient )); then
        _bashy_value="$(
            jget --output=compact "${_bashy_value}" \
                'if type == "array" then .[] else . end'
        )" \
        || return "$?"
    else
        _bashy_value="$(
            jget --output=compact "${_bashy_value}" '
                if type == "array" then
                    .[]
                else
                    "Not an array: \(.)" | halt_error(1)
                end
            '
        )" \
        || return "$?"
    fi

    # This uses `eval`.
    set-array-from-lines "${_bashy_name}" "${_bashy_value}"
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

# Performs JSON output postprocessing as directed by arguments. Expects to be
# given an _array_ of potential output (which it unwraps into a stream if so
# directed).
function json-postproc-output {
    local outputArray="$1"

    case "${_bashy_jsonOutputStyle}" in
        array)
            jpostproc <<<"${outputArray}" "${_bashy_jsonPostArgs[@]}"
            ;;
        json)
            # Extract the results out of the array, to form a "naked" sequence of
            # JSON objects, and pass that into the post-processor if necessary.
            if (( ${#_bashy_jsonPostArgs[@]} == 0 )); then
                jget "${outputArray}" '.[]'
            else
                jget "${outputArray}" '.[]' | jpostproc "${_bashy_jsonPostArgs[@]}"
            fi
            ;;
        none)
            : # Nothing to do.
            ;;
    esac
}

# Sets the JSON postprocessing arguments. This can be used in combination with
# `usual-json-output-args --no-rest` when special rest-argument handling needs
# to be done.
function set-json-postproc-args {
    _bashy_jsonPostArgs=("$@")
}

# Sets up argument processing to take the usual JSON output and postprocessing
# arguments (usual as defined by this project), arranging for them to be stored
# so they can be found by other parts of this helper library. More specifically:
#
# * Adds an `--output=<style>` option which accepts `array` (array of JSON
#   values), `json` (stream of JSON values), or `none` (suppress output). It
#   defaults to `json`.
# * Adds a `rest-arg`, which expects either no arguments or a literal `::`
#   followed by options and arguments for `json-val` (where the only option that
#   is recognized is `--output`).
function usual-json-output-args {
    local doOutput=1
    local doRest=1

    while (( $# > 0 )); do
        case "$1" in
            --no-output) doOutput=0 ;;
            --no-rest)   doRest=0   ;;
            *)
                error-msg "Unrecognized option: $1"
                return 1
        esac
        shift
    done

    # Output style.
    if (( doOutput )); then
        opt-value --var=_bashy_jsonOutputStyle --init=json \
            --enum='array json none' output
    fi

    # Optional post-processing arguments.
    if (( doRest )); then
        rest-arg --var=_bashy_jsonPostArgs post-arg
    fi
}
