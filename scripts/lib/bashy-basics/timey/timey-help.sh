#!/bin/bash
#
# Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

# Helper library for `timey`.

# Gross hack: If `date` has the `--version` option then it's GNU, otherwise
# it's BSD.
if date --version 1>&/dev/null; then
    _timey_impl=gnu
else
    _timey_impl=bsd
fi

# Formats the given seconds-time. Accepts `--utc` option. `format` argument is
# optional.
function timey-format {
    local utcOpt=()

    if [[ $1 == '--utc' ]]; then
        # `-u` works consistently. (`--utc` doesn't.)
        utcOpt=(-u)
        shift
    fi

    local time="$1"
    local formatArg=()
    if (( $# > 1 )); then
        formatArg=("$2")
    fi

    if [[ ${_timey_impl} == 'gnu' ]]; then
        date "${utcOpt[@]}" --date="@${time}" "${formatArg[@]}"
    else
        date "${utcOpt[@]}" -r "${time}" "${formatArg[@]}"
    fi
}

# Parses a given date into a number of seconds.
function timey-parse {
    local inputType="$1"
    local time="$2"

    case "${inputType}" in
        rfc822)
            if [[ ${_timey_impl} == 'gnu' ]]; then
                date --date="${time}" '+%s'
            else
                # E.g., `May 11 15:38:47 2023 PDT`.
                date -j -f '%b %d %T %Y %Z' "${time}" '+%s'
            fi
            ;;

        secs)
            if [[ ${time} == 'now' ]]; then
                date '+%s'
                return
            fi

            if [[ ${time} =~ ^0+(.*)$ ]]; then
                # Strip leading zeros, which can confuse some `date`
                # implementations.
                time="${BASH_REMATCH[1]}"
            fi

            if [[ ${_timey_impl} == 'gnu' ]]; then
                # This validates and canonicalizes the input.
                date 2>/dev/null --date="@${time}" '+%s'
            else
                # This validates and canonicalizes the input.
                date 2>/dev/null -r "${time}" '+%s'
            fi \
            || {
                error-msg "Invalid seconds-time value: ${time}"
                return 1
            }
            ;;

        *)
            error-msg "Unknown time format: ${inputType}"
            return 1
            ;;
    esac
}
