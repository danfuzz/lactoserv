# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Library for reasonably okay argument / option processing.
#
# Option processing is done in the common style with double-dashes to pass long
# options, which can optionally be passed values after an `=`, e.g. `--foo` for
# a valueless option and `--bar=zorch` for one with a value. The argument `--`
# indicates the explicit end of options, and single dash (`-`) and negative
# integers (e.g. `-123`) are interpreted as non-option arguments.
#
# The public argument-defining functions all take argument specifications of the
# form `<name>/<abbrev>=<value>`. `<name>` is the argument (long option) name.
# `<abbrev>` is a one-letter abbreviation for a single-dash option form.
# `<value>` is a (string) value to associate with the argument. `<abbrev>` and
# `<value>` are always optional and (independently) sometimes prohibited,
# depending on the definition function.
#
# The public argument-defining functions also allow these options, of which
# at least one of `--call` or `--var` must be used. When multiple of these are
# present, evaluation order is filter then call then variable setting.
# * `--call=<name>` or `--call={<code>}` -- Calls the named function passing it
#   the argument value(s), or runs the indicated code snippet. If the call
#   fails, the argument is rejected. In the snippet form, normal positional
#   parameter references (`$1` `$@` `set <value>` etc.) are available.
# * `--filter=<name>` -- Calls the named function passing it a single argument
#   value; the function must output a replacement value. If the call fails, the
#   argument is rejected. Note: The filter function runs in a subshell, and as
#   such it cannot be used to affect the global environment of the main script.
# * `--filter=/<regex>/` -- Matches each argument value against the regex. If
#   the regex doesn't match, the argument is rejected.
# * `--var=<name>` -- Sets the named variable to the argument value(s). The
#   variable is always initialized to _something_, which is itself optionally
#   specified via `--init=<value>`. If `--init` isn't used (or isn't available),
#   then the default initialized value depends on the specific function.
#
# Value-accepting argument definers allow `--enum=<spec>` as an alternate form
# of filter. In this case `<spec>` must be a space-separated list of names --
# e.g. `--enum='yes no maybe'` -- and the argument is restricted to only take on
# those possible values.
#
# Some argument-definers also accept `--required`, to indicate that the argument
# or option is required (mandatory).
#
# Beyond the above, see the docs for the functions for restrictions and
# additional options.

# Note: Regular internal functions and variables use the naming convention
# `_argproc_<name>`, where `<name>` is an otherwise normal function or variable
# name. Generated functions use the convention `_argproc:<name>`, to make the
# origin clear and to avoid collisions.

# Was there an error during argument and option declaration?
_argproc_declarationError=0

# List of statements to run just before parsing. This includes:
#
# * global variable assignment statements
_argproc_initStatements=()

# List of functions to run to parse positional arguments.
_argproc_positionalFuncs=()

# List of statements to run after parsing, to do pre-return validation. This
# includes:
#
# * required argument checkers
_argproc_preReturnStatements=()


#
# Public functions
#
# Note: In places where this code expects to set global variables and call back
# to client code, care is taken to only define local variables with names that
# are unlikely to shadow globals. ("Hooray" for dynamic scoping!)
#

# Declares an "action" option, which takes no value on a commandline. If left
# unspecified, the initial variable value for an action option is `0`, and the
# activation value is `1`.
function opt-action {
    local optCall=''
    local optInit='0'
    local optFilter=''
    local optVar=''
    local args=("$@")
    _argproc_janky-args call filter init var \
    || return 1

    local specName=''
    local specAbbrev=''
    local specHasValue=0 # Ignored, but needed because `parse-spec` will set it.
    local specValue='1'
    _argproc_parse-spec --abbrev --value "${args[0]}" \
    || return 1

    _argproc_define-no-value-arg --option \
        "${specName}" "${specValue}" "${optFilter}" "${optCall}" "${optVar}" "${specAbbrev}"

    if [[ ${optVar} != '' ]]; then
        # Set up the variable initializer.
        _argproc_initStatements+=("${optVar}=$(_argproc_quote "${optInit}")")
    fi
}

# Declares a "choice" option set, consisting of one or more options. On a
# commandline, no choice option accepts a value (because the option name itself
# implies the value). If left unspecified, the initial variable value for a
# choice option is `''` (the empty string). This definer also accepts the
# `--required` option.
function opt-choice {
    local optCall=''
    local optFilter=''
    local optInit=''
    local optRequired=0
    local optVar=''
    local args=("$@")
    _argproc_janky-args --multi-arg call filter init required var \
    || return 1

    if [[ ${optVar} != '' ]]; then
        # Set up the variable initializer.
        _argproc_initStatements+=("${optVar}=$(_argproc_quote "${optInit}")")
    fi

    local allNames=()
    local spec
    for spec in "${args[@]}"; do
        local specName=''
        local specAbbrev=''
        local specHasValue=0
        local specValue=''
        _argproc_parse-spec --abbrev --value "${spec}" \
        || return 1

        if (( !specHasValue )); then
            specValue="${specName}"
        fi

        _argproc_define-no-value-arg --option \
            "${specName}" "${specValue}" "${optFilter}" "${optCall}" "${optVar}" "${specAbbrev}"

        allNames+=("${specName}")
    done

    if (( optRequired )); then
        _argproc_add-required-arg-postcheck "${allNames[@]}"
    fi
}

# Declares a "toggle" option, which allows setting of a value to `0` or `1`. No
# `<value>` is allowed in the argument spec. The main long form option name can
# be used without a value to indicate "on" (`1`), or it can be used as
# `--<name>=1` or `--<name>=0` to indicate a specific state. In addition, the
# long form `--no-<name>` can be used to indicate "off" (`0`). If left
# unspecified, the initial variable value for a toggle option is `0`.
function opt-toggle {
    local optCall=''
    local optFilter=''
    local optInit=0
    local optVar=''
    local args=("$@")
    _argproc_janky-args call filter init var \
    || return 1

    local specName=''
    local specAbbrev=''
    _argproc_parse-spec --abbrev "${args[0]}" \
    || return 1

    if [[ ${optVar} != '' ]]; then
        # Set up the variable initializer.
        _argproc_initStatements+=("${optVar}=$(_argproc_quote "${optInit}")")
    fi

    # Extra filter on the positive option, so it can take a value.
    _argproc_define-value-taking-arg --option "${specName}" \
        '=1' $'/^[01]$/\n'"${optFilter}" "${optCall}" "${optVar}"
    _argproc_define-no-value-arg --option "no-${specName}" \
        '0' "${optFilter}" "${optCall}" "${optVar}" ''

    if [[ ${specAbbrev} != '' ]]; then
        _argproc_define-abbrev "${specAbbrev}" "${specName}"
    fi
}

# Declares a "value" option, which requires a value when passed on a
# commandline. If a <value> is passed in the spec, then the resulting option is
# value-optional, with the no-value form using the given <value>. No <abbrev> is
# allowed in the argument spec. If left unspecified, the initial variable value
# for a value option is `''` (the empty string). This definer also accepts the
# `--required` option.
function opt-value {
    local optCall=''
    local optFilter=''
    local optInit=''
    local optRequired=0
    local optVar=''
    local args=("$@")
    _argproc_janky-args call enum filter init required var \
    || return 1

    local specName=''
    local specValue=''
    _argproc_parse-spec --value-eq "${args[0]}" \
    || return 1

    if [[ ${optVar} != '' ]]; then
        # Set up the variable initializer.
        _argproc_initStatements+=("${optVar}=$(_argproc_quote "${optInit}")")
    fi

    _argproc_define-value-taking-arg --option \
        "${specName}" "${specValue}" "${optFilter}" "${optCall}" "${optVar}"

    if (( optRequired )); then
        _argproc_add-required-arg-postcheck "${specName}"
    fi
}

# Declares a positional argument. No `<abbrev>` or `<value>` is allowed in the
# argument spec. If left unspecified, the initial variable value is `''` (the
# empty string). Unlike options, a positional argument name is _only_ used for
# error messages and internal bookkeeping. This definer also accepts the
# `--required` option.
function positional-arg {
    local optCall=''
    local optFilter=''
    local optInit=''
    local optRequired=0
    local optVar=''
    local args=("$@")
    _argproc_janky-args call enum filter init required var \
    || return 1

    local specName=''
    _argproc_parse-spec "${args[0]}" \
    || return 1

    if [[ ${optVar} != '' ]]; then
        # Set up the variable initializer.
        _argproc_initStatements+=("${optVar}=$(_argproc_quote "${optInit}")")
    fi

    _argproc_define-value-taking-arg \
        "${specName}" '' "${optFilter}" "${optCall}" "${optVar}"

    if (( optRequired )); then
        _argproc_add-required-arg-postcheck "${specName}"
    fi

    _argproc_positionalFuncs+=("_argproc:positional-${specName}")
}

# Adds a call to perform post-processing -- usually checking -- after an
# otherwise successful call to `process-args`. This accepts a function name and
# zero or more arguments.
function post-process-args-call {
    local args=("$@")
    _argproc_janky-args --multi-arg \
    || return 1

    _argproc_preReturnStatements+=("$(printf '%q ' "${args[@]}")")
}

# Processes all of the given arguments, according to the configured handlers.
# Returns normally upon successful processing. If there is any trouble parsing
# (including if there were errors during argument/option declaration), this
# prints the short form of the `usage` message (if `usage` is available) and
# then returns with a non-zero code.
function process-args {
    local _argproc_error=0
    local _argproc_s

    if (( _argproc_declarationError )); then
        _argproc_error-coda 'Cannot process arguments, due to declaration errors.'
        return 1
    fi

    # Run all the pre-parse statements.
    for _argproc_s in "${_argproc_initStatements[@]}"; do
        eval "${_argproc_s}"
    done

    # Build up the statements to evaluate, and evaluate them.
    local _argproc_statements=()
    _argproc_statements-from-args "$@" \
    || _argproc_error="$?"

    for _argproc_s in "${_argproc_statements[@]}"; do
        eval "${_argproc_s}" || _argproc_error="$?"
    done

    if (( _argproc_error )); then
        # Don't continue if there were problems above, because that will lead to
        # spurious extra errors (e.g. "missing" a required option that was
        # present but didn't pass a validity check).
        _argproc_error-coda
        return "${_argproc_error}"
    fi

    # Do any post-parse checks.
    for _argproc_s in "${_argproc_preReturnStatements[@]}"; do
        eval "${_argproc_s}" || _argproc_error="$?"
    done

    if (( _argproc_error )); then
        _argproc_error-coda
        return "${_argproc_error}"
    fi
}

# Requires that exactly one of the indicated arguments / options is present.
function require-exactly-one-arg-of {
    local args=("$@")
    _argproc_janky-args --multi-arg \
    || return 1

    local allNames=()
    local spec
    for spec in "${args[@]}"; do
        local specName=''
        _argproc_parse-spec "${spec}" \
        || return 1

        allNames+=("${specName}")
    done

    _argproc_add-required-arg-postcheck --exactly-one "${allNames[@]}" \
    || return 1
}

# Declares a "rest" argument, which gets all the otherwise-untaken positional
# arguments, during parsing. If this is not declared, argument processing will
# report an error in the presence of any "rest" arguments. The initial variable
# value is `()` (the empty array).
function rest-arg {
    local optCall=''
    local optFilter=''
    local optVar=''
    local args=("$@")
    _argproc_janky-args call enum filter var \
    || return 1

    if declare >/dev/null -F _argproc:rest; then
        error-msg --file-line=1 'Duplicate definition of rest argument.'
        return 1
    fi

    local specName=''
    _argproc_parse-spec "${args[0]}" \
    || return 1

    if [[ ${optVar} != '' ]]; then
        # Set up the variable initializer.
        _argproc_initStatements+=("${optVar}=()")
    fi

    _argproc_define-multi-value-arg \
        "${specName}" "${optFilter}" "${optCall}" "${optVar}" \
    || return "$?"
}


#
# Library-internal functions
#

# Adds a pre-return check which fails if none of the indicated arguments/options
# was present on the commandline, and optionally if more than exactly one was
# present.
function _argproc_add-required-arg-postcheck {
    local exactlyOne=0
    if [[ $1 == '--exactly-one' ]]; then
        exactlyOne=1
        shift
    fi

    _argproc_preReturnStatements+=('local _argproc_count=0')

    local argNoun='option'
    local allNames=''

    local longName desc
    for longName in "$@"; do
        _argproc_preReturnStatements+=("$(
            printf '[[ ${_argproc_receivedArgNames} =~ "<%s>" ]] && (( _argproc_count++ )) || true' \
                "${longName}"
        )")

        desc="$(_argproc_arg-description --short "${longName}")" || return 1
        if ! [[ ${desc} =~ ^- ]]; then
            # The description doesn't start with a dash (`-`), so it's an
            # argument, not an option.
            argNoun='argument'
        fi

        allNames+=" ${desc}"
    done

    local errorMsg

    if (( exactlyOne )); then
        errorMsg="Too many ${argNoun}s from set:${allNames}"
        _argproc_preReturnStatements+=("$(
            printf '(( _argproc_count <= 1 )) || { error-msg %q; false; }' \
                "${errorMsg}"
        )")
    fi

    if (( $# == 1 )); then
        errorMsg="Missing required ${argNoun}${allNames}."
    else
        errorMsg="Missing required ${argNoun} from set:${allNames}"
    fi

    _argproc_preReturnStatements+=(
        "$(printf $'(( _argproc_count != 0 )) || { error-msg %q; false; }\n' \
            "${errorMsg}"
    )")
}

# Gets the description of the named argument.
function _argproc_arg-description {
    local short=0
    if [[ $1 == '--short' ]]; then
        short=1
        shift
    fi

    local longName="$1"
    local funcName="_argproc:arg-description-${longName}"
    local desc

    if ! declare -F "${funcName}" >/dev/null; then
        error-msg --file-line=1 "No such argument: <${longName}>"
        return 1
    fi

    desc="$("${funcName}")" \
    || return 1

    if (( short )); then
        echo "${desc/* /}"
    else
        echo "${desc}"
    fi
}

# Defines an "abbrev" function, which is what gets called to activate a
# short-form option.
function _argproc_define-abbrev {
    local abbrevChar="$1"
    local longName="$2"

    eval 'function _argproc:abbrev-'"${abbrevChar}"' {
        _argproc:long-'"${longName}"' "$@"
    }'
}

# Defines an activation function for a multi-value argument.
function _argproc_define-multi-value-arg {
    local longName="$1"
    local filter="$2"
    local callFunc="$3"
    local varName="$4"

    _argproc_set-arg-description "${specName}" rest-argument || return 1

    local desc="argument <${longName}>"
    local handlerBody="$(
        _argproc_handler-body "${longName}" "${desc}" "${filter}" "${callFunc}" "${varName}"
    )"

    eval 'function _argproc:rest {
        '"${handlerBody}"'
    }'
}

# Defines an activation function for an argument/option which prohibits getting
# passed a value.
function _argproc_define-no-value-arg {
    if [[ $1 == '--option' ]]; then
        shift
    else
        # `--option` is really defined here for parallel structure, not utility.
        error-msg --file-line=1 'Not supported.'
        return 1
    fi

    local longName="$1"
    local value="$2"
    local filter="$3"
    local callFunc="$4"
    local varName="$5"
    local abbrevChar="$6"

    _argproc_set-arg-description "${longName}" option || return 1

    local desc="$(_argproc_arg-description "${longName}")"
    local handlerName="_argproc:long-${longName}"
    local handlerBody="$(
        _argproc_handler-body "${longName}" "${desc}" "${filter}" "${callFunc}" "${varName}"
    )"

    value="$(_argproc_quote "${value}")"

    eval 'function '"${handlerName}"' {
        if (( $# > 0 )); then
            error-msg "Value not allowed for '"${desc}"'."
            return 1
        fi
        set '"${value}"'
        '"${handlerBody}"'
    }'

    if [[ ${abbrevChar} != '' ]]; then
        _argproc_define-abbrev "${abbrevChar}" "${longName}"
    fi
}

# Defines an activation function for an argument/option which can or must be
# passed a value.
function _argproc_define-value-taking-arg {
    local isOption=0
    if [[ $1 == '--option' ]]; then
        isOption=1
        shift
    fi

    local longName="$1"
    local eqDefault="$2"
    local filter="$3"
    local callFunc="$4"
    local varName="$5"

    local handlerName
    if (( isOption )); then
        _argproc_set-arg-description "${longName}" option || return 1
        handlerName="_argproc:long-${longName}"
    else
        _argproc_set-arg-description "${longName}" argument || return 1
        handlerName="_argproc:positional-${longName}"
    fi

    local desc="$(_argproc_arg-description "${longName}")"
    local handlerBody="$(
        _argproc_handler-body "${longName}" "${desc}" "${filter}" "${callFunc}" "${varName}"
    )"

    local ifNoValue=''
    if [[ ${eqDefault} == '' ]]; then
        # No default value, therefore value required.
        ifNoValue='
            error-msg "Value required for '"${desc}"'."
            return 1'
    else
        eqDefault="$(_argproc_quote "${eqDefault:1}")" # `:1` to drop the `=`.
        ifNoValue="set -- ${eqDefault}"
    fi

    eval 'function '"${handlerName}"' {
        if (( $# < 1 )); then
            '"${ifNoValue}"'
        fi
        '"${handlerBody}"'
    }'

    if [[ ${abbrevChar} != '' ]]; then
        _argproc_define-abbrev "${abbrevChar}" "${longName}"
    fi
}

# Helper for `process-args`, which prints an optional final error message and
# then short `usage` if it is defined.
function _argproc_error-coda {
    local msg=("$@")

    if (( ${#msg[@]} != 0 )); then
        error-msg "${msg[@]}"
    fi

    if declare -F usage >/dev/null; then
        error-msg ''
        usage --short
    fi
}

# Produces an argument handler body, from the given components.
function _argproc_handler-body {
    local longName="$1"
    local desc="$2"
    local filters="$3"
    local callFunc="$4"
    local varName="$5"
    local result=()

    while [[ ${filters} =~ ^$'\n'*([^$'\n']+)(.*)$ ]]; do
        local f="${BASH_REMATCH[1]}"
        filters="${BASH_REMATCH[2]}"
        if [[ ${f} =~ ^/(.*)/$ ]]; then
            # Add a call to perform the regex check on each argument.
            f="${BASH_REMATCH[1]}"
            result+=("$(printf \
                '_argproc_regex-filter-check %q %q "$@" || return "$?"\n' \
                "${desc}" "${f}"
            )")
        else
            # Add a loop to call the filter function on each argument.
            result+=(
                "$(printf '
                    local _argproc_value _argproc_args=()
                    for _argproc_value in "$@"; do
                        _argproc_args+=("$(%s "${_argproc_value}")") || return 1
                    done
                    set -- "${_argproc_args[@]}"' \
                    "${f}")"
            )
        fi
    done

    if [[ ${callFunc} =~ ^\{(.*)\}$ ]]; then
        # Add a compound statement for the code block.
        result+=(
            "$(printf '{\n%s\n} || return "$?"\n' "${BASH_REMATCH[1]}")"
        )
    elif [[ ${callFunc} != '' ]]; then
        result+=(
            "$(printf '%s "$@" || return "$?"' "${callFunc}")"
        )
    fi

    if [[ ${varName} != '' ]]; then
        result+=(
            "$(printf '%s=("$@")' "${varName}")"
        )
    fi

    result+=(
        "$(printf '_argproc_receivedArgNames+="<%s>"' "${longName}")"
    )

    printf '%s\n' "${result[@]}"
}

# Janky yet reasonable argument parser for the commands in this library. (How
# meta!) Takes a list of option names to accept, each of which is parsed in a
# standard way (e.g. `var` is always a variable name, etc.). Sets `opt<Name>`
# (presumed to be a local variable declared in the calling scope) for each
# parsed option. Assumes the variable `args` (again presumed local to the
# caller) contains all the arguments, which gets updates by this function.
# After option parsing, this expects there to be one argument remaining, except
# if `--multi-arg` is passed to this function, in which case there must be _at
# least_ one.
function _argproc_janky-args {
    local multiArg=0
    if [[ $1 == '--multi-arg' ]]; then
        multiArg=1
        shift
    fi

    local argError=0
    local argSpecs=" $* " # Spaces on the ends to make the match code work.
    local optsDone=0
    local gotInit=0
    local a

    for a in "${args[@]}"; do
        if (( optsDone )); then
            args+=("${a}")
            continue
        fi

        if [[ ${a} =~ ^--. ]]; then
            if ! [[ ${a} =~ ^--([a-z][-a-z]+)(=.*)?$ ]]; then
                error-msg --file-line=2 "Invalid option syntax: ${a}"
                _argproc_declarationError=1
                return 1
            fi

            local name="${BASH_REMATCH[1]}"
            local value="${BASH_REMATCH[2]}"

            if ! [[ ${argSpecs} =~ " ${name} " ]]; then
                error-msg --file-line=2 "Unknown option: --${name}"
                _argproc_declarationError=1
                return 1
            fi

            case "${name}" in
                call)
                    [[ ${value} =~ ^=(\{.*\}|[_a-zA-Z][-_:a-zA-Z0-9]*)$ ]] \
                    && optCall="${BASH_REMATCH[1]}" \
                    || argError=1
                    ;;
                init)
                    gotInit=1
                    [[ ${value} =~ ^=(.*)$ ]] \
                    && optInit="${BASH_REMATCH[1]}" \
                    || argError=1
                    ;;
                enum)
                    if [[ ${value} =~ ^=(' '*([-_:.a-zA-Z0-9]+' '*)+)$ ]]; then
                        # Re-form as a filter expression.
                        value="${BASH_REMATCH[1]}"
                        optFilter=''
                        while [[ ${value} =~ ^' '*([^ ]+)' '*(.*)$ ]]; do
                            optFilter+="|${BASH_REMATCH[1]}"
                            value="${BASH_REMATCH[2]}"
                        done
                        # `:1` to drop the initial `|`.
                        optFilter="/^(${optFilter:1})\$/"
                        # "Escape" `.` so it's not treated as regex syntax.
                        optFilter="${optFilter//./[.]}"
                    else
                        argError=1
                    fi
                    ;;
                filter)
                    [[ ${value} =~ ^=(/.*/|[_a-zA-Z][-_:a-zA-Z0-9]*)$ ]] \
                    && optFilter="${BASH_REMATCH[1]}" \
                    || argError=1
                    ;;
                required)
                    [[ ${value} == '' ]] \
                    && optRequired=1 \
                    || argError=1
                    ;;
                var)
                    [[ ${value} =~ ^=([_a-zA-Z][_a-zA-Z0-9]*)$ ]] \
                    && optVar="${BASH_REMATCH[1]}" \
                    || argError=1
                    ;;
                *)
                    error-msg --file-line=2 "Unknown arg-processing option: --${name}"
                    _argproc_declarationError=1
                    return 1
                    ;;
            esac

            if (( argError )); then
                if [[ ${value} != '' ]]; then
                    error-msg --file-line=2 "Invalid value for option --${name}: ${value:1}"
                else
                    error-msg --file-line=2 "Value required for option --${name}."
                fi
                _argproc_declarationError=1
                return 1
            fi
        elif [[ ${a} == '--' ]]; then
            # Explicit end of options.
            args=()
            optsDone=1
        elif [[ (${a} == '-') || (${a:0:1} != '-') ]]; then
            # Non-option argument.
            args=("${a}")
            optsDone=1
        else
            error-msg --file-line=2 "Invalid option syntax: ${a}"
            _argproc_declarationError=1
            return 1
        fi
    done

    if (( !optsDone || (${#args[@]} == 0) )); then
        error-msg --file-line=2 'Missing argument specification.'
        _argproc_declarationError=1
        return 1
    elif (( ${#args[@]} > 1 && !multiArg )); then
        error-msg --file-line=2 'Too many arguments.'
        _argproc_declarationError=1
        return 1
    elif (( gotInit && optRequired )); then
        # Special case: `--init` is meaningless if `--required` was passed.
        error-msg --file-line=2 'Cannot use both --required and --init.'
        _argproc_declarationError=1
        return 1
    elif (( gotInit )) && [[ ${optVar} == '' ]]; then
        # Special case: `--init` is meaningless without `--var`.
        error-msg --file-line=2 'Must use --var when --init is used.'
        _argproc_declarationError=1
        return 1
    elif [[ ${argSpecs} =~ ' call '|' var ' ]]; then
        # Special case for `--call` and `--var` (which always go together).
        if [[ (${optCall} == '') && (${optVar} == '') ]]; then
            error-msg --file-line=2 'Must use at least one of --call or --var.'
            _argproc_declarationError=1
            return 1
        fi
    fi
}

# Parses a single argument / option spec. `--abbrev` to accept an abbreviation.
# `--value` to accept a value. `--value-eq` to accept a value and leave the
# `=` in the result (to distinguish unset and set-to-empty). Sets `spec<Item>`
# (presumed locals in the calling scope) to "return" results.
function _argproc_parse-spec {
    local abbrevOk=0
    local valueOk=0
    local valueWithEq=0
    while [[ $1 =~ ^-- ]]; do
        case "$1" in
            --abbrev)   abbrevOk=1               ;;
            --value)    valueOk=1                ;;
            --value-eq) valueOk=1; valueWithEq=1 ;;
            *)
                error-msg --file-line=1 "Unrecognized option: $1"
                _argproc_declarationError=1
                return 1
                ;;
        esac
        shift
    done

    local spec="$1"

    if ! [[ ${spec} =~ ^([a-zA-Z0-9][-a-zA-Z0-9]*)(/[a-zA-Z])?(=.*)?$ ]]; then
        error-msg --file-line=2 "Invalid spec: ${spec}"
        _argproc_declarationError=1
        return 1
    fi

    specName="${BASH_REMATCH[1]}" # Name always allowed. Others need to be checked.
    local abbrev="${BASH_REMATCH[2]}"
    local value="${BASH_REMATCH[3]}"

    if (( abbrevOk )); then
        specAbbrev="${abbrev:1}" # `:1` to drop the slash.
    elif [[ ${abbrev} != '' ]]; then
        error-msg --file-line=2 "Abbrev not allowed in spec: ${spec}"
        _argproc_declarationError=1
        return 1
    fi

    if (( valueOk )); then
        if (( !valueWithEq )); then
            specHasValue="$([[ ${value} == '' ]]; echo "$?")"
        fi

        if [[ ${value} != '' ]]; then
            if (( !valueWithEq )); then
                value="${value:1}" # `:1` to drop the equal sign.
            fi
            specValue="${value}"
        fi
    elif [[ ${value} != '' ]]; then
        error-msg --file-line=2 "Value not allowed in spec: ${spec}"
        _argproc_declarationError=1
        return 1
    fi
}

# Helper (called by code produced by `_argproc_handler-body`) which performs
# a regex filter check.
function _argproc_regex-filter-check {
    local desc="$1"
    local regex="$2"
    shift 2

    local arg
    for arg in "$@"; do
        if [[ ! (${arg} =~ ${regex}) ]]; then
            error-msg "Invalid value for ${desc}: ${arg}"
            return 1
        fi
    done
}

# Sets the description of the named argument based on its type. This function
# will fail if an argument with the given name was already defined.
function _argproc_set-arg-description {
    local longName="$1"
    local typeName="$2"

    local funcName="_argproc:arg-description-${longName}"

    if declare -F "${funcName}" >/dev/null; then
        error-msg --file-line=3 "Duplicate argument: ${longName}"
        _argproc_declarationError=1
        return 1
    fi

    local desc
    case "${typeName}" in
        argument)
            desc="argument <${longName}>"
            ;;
        option)
            desc="option --${longName}"
            ;;
        rest-argument)
            desc="rest argument <${longName}...>"
            ;;
        *)
            error-msg --file-line=1 "Unknown type: ${typeName}"
            _argproc_declarationError=1
            return 1
            ;;
    esac

    eval 'function '"${funcName}"' {
        echo '"$(_argproc_quote "${desc}")"'
    }'
}

# Builds up a list of statements to evaluate, based on the given arguments. It
# is stored in the variable `_argproc_statements`, which is assumed to be
# declared by its caller.
#
# Note: This arrangement, where argument parsing is done in a separate
# function and as a separate pass from evaluation, makes it possible to use
# non-mangled local variables in the more tricky code, so it's a bit nicer to
# read.
function _argproc_statements-from-args {
    local argError=0
    local arg handler name value

    # This is used for required-argument checking.
    _argproc_statements+=($'local _argproc_receivedArgNames=\'\'')

    while (( $# > 0 )); do
        arg="$1"

        if [[ ${arg} == '--' ]]; then
            # Explicit end of options.
            shift
            break
        elif [[ ${arg} == '' || ${arg} =~ ^-[0-9]*$ || ${arg} =~ ^[^-] ]]; then
            # Non-option argument.
            break
        elif [[ ${arg} =~ ^--([-a-zA-Z0-9]+)(=.*)?$ ]]; then
            # Long-form argument.
            name="${BASH_REMATCH[1]}"
            value="${BASH_REMATCH[2]}"
            handler="_argproc:long-${name}"
            if ! declare -F "${handler}" >/dev/null; then
                error-msg "Unknown option: --${name}"
                argError=1
            elif [[ ${value} == '' ]]; then
                _argproc_statements+=("${handler}")
            else
                # `:1` to drop the `=` from the start of `value`.
                _argproc_statements+=("${handler} $(_argproc_quote "${value:1}")")
            fi
        elif [[ $arg =~ ^-([a-zA-Z0-9]+)$ ]]; then
            # Short-form argument.
            arg="${BASH_REMATCH[1]}"
            while [[ ${arg} =~ ^(.)(.*)$ ]]; do
                name="${BASH_REMATCH[1]}"
                arg="${BASH_REMATCH[2]}"
                handler="_argproc:abbrev-${name}"
                if ! declare -F "${handler}" >/dev/null; then
                    error-msg "Unknown option: -${name}"
                    argError=1
                    # Break, to avoid spewing a ton of errors in case of a pilot
                    # error along the lines of `-longOptionName`.
                    break
                else
                    _argproc_statements+=("${handler}")
                fi
            done
        else
            # Something weird and invalid, e.g. `--=`.
            error-msg "Invalid option syntax: ${arg}"
            argError=1
        fi

        shift
    done

    local func
    for func in "${_argproc_positionalFuncs[@]}"; do
        if (( $# == 0 )); then
            break
        fi

        _argproc_statements+=("${func} $(_argproc_quote "$1")")
        shift
    done

    if declare -F _argproc:rest >/dev/null; then
        _argproc_statements+=("_argproc:rest $(_argproc_quote "$@")")
    elif (( $# > 0 )); then
        if (( ${#_argproc_positionalFuncs[@]} == 0 )); then
            error-msg 'Positional arguments are not allowed.'
        else
            error-msg 'Too many positional arguments.'
        fi
        argError=1
    fi

    return "${argError}"
}

# Quotes one or more literal strings, space separated, so they can be safely
# used in evaluated code. This (successfully) prints nothing if no arguments are
# given.
function _argproc_quote {
    case "$#" in
        0)
            : # Nothing to print.
            ;;
        1)
            printf '%q' "$1"
            ;;
        *)
            printf '%q' "$1"
            shift
            printf ' %q' "$@"
            ;;
    esac
}
