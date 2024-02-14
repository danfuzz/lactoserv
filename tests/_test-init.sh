# Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

. "${BASH_SOURCE[0]%/*}/_init.sh" || return "$?"


#
# Global variables
#

# Have there been any calls to log test results?
_test_anyLoggedResults=0


#
# Library functions
#

# Calls a function, wrapping its output in a standard form, writing it all
# (including stderr) to stdout.
function call-and-log-as-test {
    local label="$1"
    shift
    local cmd=("$@")

    if (( !_test_anyLoggedResults )); then
        _test_anyLoggedResults=1
    else
        echo ''
        echo '- - - - - - - - - -'
        echo ''
    fi

    echo "## ${label}"
    echo ''

    # What's going on here: We capture both stdout and stderr of the call to
    # log, and then emit them to stdout in a specific order and with
    # standardized markings.

    local output
    output="$(
        (
            # Print the PID of the subshell we are currently in.
            sh 1>&2 -c 'echo "${PPID}"'

            "${cmd[@]}" > >(_test_do-stream-marking stdout)
        ) 2> >(_test_do-stream-marking --wait stderr)
    )"
    local exitCode="$?"

    awk <<<"${output}" '
    BEGIN {
        finishSection();
    }

    /^[a-z]+:$/ {
        finishSection();
        label = substr($0, 1, length($0) - 1);
    }

    /^[a-z]+- / {
        finalNl = 0;
    }

    /^[a-z]+-? / {
        if (!any) {
            any = 1;
            print "###", label;
            print "```";
        }
        sub(/^[^ ]+ /, "");
        print;
    }

    END {
        finishSection();
    }

    function finishSection() {
        if (any) {
            print "```";
            if (!finalNl) {
                print "(no newline at end)";
            }
            print "";
        }

        any = 0;
        finalNl = 1;
        label = "";
    }
    '

    echo "### exit: ${exitCode}"
}


#
# Internal functions
#

# Helper for `call-and-log-as-test`, which re-emits its input with each line
# prefixed, optionally waiting for a particular PID to exit first.
function _test_do-stream-marking {
    local pid=''
    if [[ $1 == '--wait' ]]; then
        shift
        IFS='' read -r pid
    fi

    local mark="$1"

    if [[ ${pid} != '' ]]; then
        while kill 2>/dev/null -0 "${pid}"; do
            sleep 0.1
        done
    fi

    local any=0

    local str
    while IFS='' read -r str; do
        if (( !any )); then
            any=1
            printf '%s:\n' "${mark}"
        fi
        printf '%s %s\n' "${mark}" "${str}"
    done

    # If we hit EOF on the read, that is, if the final line of output read
    # didn't end with a newline, then `str` will be non-empty.
    if [[ ${str} != '' ]]; then
        if (( !any )); then
            any=1
            printf '%s:\n' "${mark}"
        fi
        printf '%s- %s\n' "${mark}" "${str}"
    fi
}
