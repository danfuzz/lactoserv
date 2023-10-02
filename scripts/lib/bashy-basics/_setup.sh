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

# Calls `lib jarray`.
function jarray {
    lib jarray "$@"
}

# Calls `lib jget`.
function jget {
    lib jget "$@"
}

# Calls `lib jlength`.
function jlength {
    lib jlength "$@"
}

# Calls `lib jstring`.
function jstring {
    lib jstring "$@"
}

# Calls `lib jval`.
function jval {
    lib jval "$@"
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

# Interprets standardized (for this project) JSON "post-processing" arguments.
# This processes `stdin`. The arguments must start with `::`. After that are
# options and arguments just as with `jval`, except `--input` is not accepted.
#
# As a convenience, if not passed any arguments at all (not even `::`), this
# just (re)formats `stdin` to `stdout` using `jval`.
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
                if ! [[ "${outputStyle}" =~ ^(compact|json|lines|none|raw|raw0|words)$ ]]; then
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
        # No need to run a nop-filter just to not-produce output. That said,
        # because whatever is feeding into this nop-filter _might_ want to write
        # and _might_ get unhappy if it finds its output closed (looking at you
        # `jq`), we still `cat` the input and just drop it on the floor.
        cat >/dev/null
        return
    fi

    jval --input=read --output="${outputStyle}" -- "$@" \
    || {
        error-msg 'Trouble with post-processing.'
        return 1
    }
}

# Converts a JSON array to a Bash array of elements. Stores into the named
# variable. With option `--lenient`, treats a non-array as a single-element
# array. By default, the set elements are JSON values; with option `--raw`,
# produces raw (unquoted strings, etc.) elements.
function jset-array {
    # Note: Because we use `eval`, local variables are given name prefixes to
    # avoid conflicts with the caller.

    local _bashy_lenient=false
    local _bashy_raw=false
    while true; do
        case "$1" in
            --lenient)
                _bashy_lenient=true
                ;;
            --raw)
                _bashy_raw=true
                ;;
            *)
                break
                ;;
        esac
        shift
    done

    local _bashy_name="$1"
    local _bashy_value="$2"

    eval "$(
        jget --output=raw "${_bashy_value}" \
            lenient:json="${_bashy_lenient}" \
            name="${_bashy_name}" \
            raw:json="${_bashy_raw}" \
        '
            def processOne:
                if $raw and (type == "string") then . else tojson end
                | "  \(@sh)"
            ;

            if $lenient then
                if type == "array" then . else [.] end
            elif type == "array" then
                .
            else
                "Not an array: \(.)\n" | halt_error(1)
            end
            | map(processOne)
            | ["\($name)=(", .[], ")"]
            | join("\n")
        '
    )"
}

# Performs JSON output postprocessing as directed by originally-passed
# options/arguments. Expects to be given a JSON _array_ of potential output
# (which it unwraps into a stream if so directed).
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
        raw|raw0|words)
            jget "${outputArray}" --output="${_bashy_jsonOutputStyle}" '.[]'
            ;;
        '')
            error-msg 'No JSON --output option supplied (or implied).'
            return 1
            ;;
        *)
            error-msg "Unrecognized JSON --output option: ${_bashy_jsonOutputStyle}"
            return 1
            ;;
    esac
}

# Performs JSON output processing as directed by originally-passed
# options/arguments. Expects to be passed a series of individual strings of
# potential output.
function json-postproc-strings {
    local output=("$@")

    case "${_bashy_jsonOutputStyle}" in
        array)
            # Form a JSON array, and tell the postprocessor about it.
            jarray --input=strings -- "${output[@]}" \
            | jpostproc "${_bashy_jsonPostArgs[@]}"
            ;;
        json)
            # Form a sequence of JSON strings, and tell the postprocessor about
            # it.
            jstring -- "${output[@]}" \
            | jpostproc "${_bashy_jsonPostArgs[@]}"
            ;;
        none)
            : # Nothing to do.
            ;;
        raw|raw0|words)
            # Form a sequence of JSON strings, and then ask `jval` to use its
            # output processing on it.
            jstring -- "${output[@]}" \
            | jval --input=read --output="${_bashy_jsonOutputStyle}"
            ;;
        '')
            error-msg 'No JSON --output option supplied (or implied).'
            return 1
            ;;
        *)
            error-msg "Unrecognized JSON --output option: ${_bashy_jsonOutputStyle}"
            return 1
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
# * Adds an `--output=<style>` option which accepts `array`, json`, `none`,
#   `raw`, `raw0`, or `words`. It defaults to `json`. These all have the same
#   meaning as with `jval`, with the one extra detail that `json` means a stream
#   of JSON values, and array means a single JSON array of all results.
# * Adds a `rest-arg`, which expects either no arguments or a literal `::`
#   followed by options and arguments for `jval` (where the only option that is
#   recognized is `--output`).
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
            --enum='array json none raw raw0 words' output
    else
        _bashy_jsonOutputStyle=json
    fi

    # Optional post-processing arguments.
    if (( doRest )); then
        rest-arg --var=_bashy_jsonPostArgs post-arg
    fi
}
