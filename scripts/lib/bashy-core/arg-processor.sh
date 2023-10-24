# Copyright 2022-2023 the Bashy-lib Authors (Dan Bornstein et alia).
# SPDX-License-Identifier: Apache-2.0

#
# Library for reasonably okay argument / option processing.
#
# Option processing is done in the common style with double-dashes to pass long
# options, which can optionally be passed values after an `=`, e.g. `--foo` for
# a valueless option and `--bar=zorch` for one with a value. The argument `--`
# indicates the explicit end of options, and both single dash (`-`) and negative
# integers (e.g. `-123`) are interpreted as non-option arguments.
#
# The public argument-defining functions all take argument specifications of the
# form `<name>/<short>=<value>`. `<name>` is the argument (long option) name.
# `<short>` is a one-letter short-option abbreviation for a single-dash option
# form. `<value>` is a (string) value to associate with the argument. `<short>`
# and `<value>` are always optional and (independently) sometimes prohibited,
# depending on the definition function.
#
# Most public argument-defining functions also all allow these options, of which
# at least one must be used. When both are used, the `--call` is performed
# first, and then the `--var` setting.
# present, evaluation order is filter then call then variable setting.
# * `--call=<name>` or `--call={<code>}` -- Calls the named function passing it
#   the argument value(s), or runs the indicated code snippet. If the call
#   fails, the argument is rejected. In the snippet form, normal positional
#   parameter references (`$1` `$@` `set <value>` etc.) are available.
# * `--var=<name>` -- Sets the named variable to the argument value(s).
#
# Value-accepting argument definers allow these additional options to pre-filter
# a value, before it gets set or passed to a `--call`:
# * `--filter=<name>` -- Calls the named function passing it a single argument
#   value; the function must output a replacement value. If the call fails, the
#   argument is rejected. Note: The filter function runs in a subshell, and as
#   such it cannot be used to affect the global environment of the main script.
# * `--filter=/<regex>/` -- Matches each argument value against the regex. If
#   the regex doesn't match, the argument is rejected.
# * `--enum=<spec>` -- Matches each argument value against a set of valid names.
#   `<spec>` must be a space-separated list of names, e.g. `--enum='yes no
#   maybe'`.
#
# Some argument-definers also accept these options:
# * `--default=<value>` -- Specifies a default value for an argument or option
#   if it isn't explicitly passed. This is only valid to use if `--var` is also
#   used.
# * `--required` -- Indicates that the argument or option is required
#   (mandatory). **Note:** `--required` and `--default` are mutually exclusive.
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
# * `--required` argument checkers
# * client-added post-processing calls
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
    local optDefault='0'
    local optVar=''
    local args=("$@")
    _argproc_janky-args call default var \
    || return 1

    local specName=''
    local specHasValue=0 # Ignored, but needed because `parse-spec` will set it.
    local specShort=''
    local specValue='1'
    _argproc_parse-spec --short --value "${args[0]}" \
    || return 1

    _argproc_define-no-value-arg --option \
        "${specName}" "${specValue}" "${optCall}" "${optVar}" "${specShort}"

    if [[ ${optVar} != '' ]]; then
        # Set up the variable initializer.
        _argproc_initStatements+=("${optVar}=$(_argproc_quote "${optDefault}")")
    fi
}

# Declares an "alias" option, which expands into an arbitrary set of other
# options. On a commandline, alias options do not accept values (because values,
# if any, are provided in the expansion). Similarly, and unlike most of the
# argument-definining functions, alias options cannot be specified with either
# `--call` or `--var` (because any calls or variable setting is done with the
# expanded options). In fact, _no_ options are available when defining an alias.
function opt-alias {
    local args=("$@")
    _argproc_janky-args --multi-arg \
    || return 1

    local specName=''
    local specShort=''
    _argproc_parse-spec --short "${args[0]}" \
    || return 1

    args=("${args[@]:1}")

    local arg
    for arg in "${args[@]}"; do
        if [[ ! (${arg} =~ ^-) ]]; then
            error-msg --file-line=1 "Invalid alias expansion: ${arg}"
            return 1
        fi
    done

    _argproc_define-alias-arg --option "${specName}" "${specShort}" \
        "${args[@]}"
}

# Declares a "multi-value" option, which allows passing zero or more values. No
# `<short>` or `<value>` is allowed in the argument spec. These options are
# accepted via the syntax `--<name>[]=<values>` where <values> is a
# space-separated list of literal values, with standard shell quoting and
# escaping allowed in order to pass special characters. This definer also
# accepts the `--required` option. The initial variable value is `()` (the empty
# array).
function opt-multi {
    local optCall=''
    local optFilter=''
    local optRequired=0
    local optVar=''
    local args=("$@")
    _argproc_janky-args call enum filter required var \
    || return 1

    local specName=''
    _argproc_parse-spec "${args[0]}" \
    || return 1

    if [[ ${optVar} != '' ]]; then
        # Set up the variable initializer.
        _argproc_initStatements+=("${optVar}=()")
    fi

    _argproc_define-multi-value-arg --option \
        "${specName}" "${optFilter}" "${optCall}" "${optVar}" \
    || return "$?"

    if (( optRequired )); then
        _argproc_add-required-arg-postcheck "${specName}"
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
    local optDefault=0
    local optVar=''
    local args=("$@")
    _argproc_janky-args call default var \
    || return 1

    local specName=''
    local specShort=''
    _argproc_parse-spec --short "${args[0]}" \
    || return 1

    if [[ ${optVar} != '' ]]; then
        # Set up the variable initializer.
        _argproc_initStatements+=("${optVar}=$(_argproc_quote "${optDefault}")")
    fi

    _argproc_define-value-taking-arg --option \
        "${specName}" '=1' '/^[01]$/' "${optCall}" "${optVar}"
    _argproc_define-alias-arg --option "no-${specName}" '' "--${specName}=0"

    if [[ ${specShort} != '' ]]; then
        _argproc_define-alias-arg --short-only "${specName}" "${specShort}"
    fi
}

# Declares a "value" option, which allows passing an arbitrary value. If a
# <value> is passed in the spec, then the resulting option is value-optional,
# with the no-value form using the given <value>. No <short> is allowed in the
# argument spec. If left unspecified, the default variable value for a value
# option is `''` (the empty string). This definer also accepts the `--required`
# option.
function opt-value {
    local optCall=''
    local optDefault=''
    local optFilter=''
    local optRequired=0
    local optVar=''
    local args=("$@")
    _argproc_janky-args call default enum filter required var \
    || return 1

    local specName=''
    local specValue=''
    _argproc_parse-spec --value-eq "${args[0]}" \
    || return 1

    if [[ ${optVar} != '' ]]; then
        # Set up the variable initializer.
        _argproc_initStatements+=("${optVar}=$(_argproc_quote "${optDefault}")")
    fi

    _argproc_define-value-taking-arg --option \
        "${specName}" "${specValue}" "${optFilter}" "${optCall}" "${optVar}" \
    || return "$?"

    if (( optRequired )); then
        _argproc_add-required-arg-postcheck "${specName}"
    fi
}

# Declares a positional argument. No `<short>` or `<value>` is allowed in the
# argument spec. If left unspecified, the initial variable value is `''` (the
# empty string). Unlike options, a positional argument name is _only_ used for
# error messages and internal bookkeeping. This definer also accepts the
# `--required` option.
function positional-arg {
    local optCall=''
    local optDefault=''
    local optFilter=''
    local optRequired=0
    local optVar=''
    local args=("$@")
    _argproc_janky-args call default enum filter required var \
    || return 1

    local specName=''
    _argproc_parse-spec "${args[0]}" \
    || return 1

    if [[ ${optVar} != '' ]]; then
        # Set up the variable initializer.
        _argproc_initStatements+=("${optVar}=$(_argproc_quote "${optDefault}")")
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

    local specName=''
    _argproc_parse-spec "${args[0]}" \
    || return 1

    if [[ ${optVar} != '' ]]; then
        # Set up the variable initializer.
        _argproc_initStatements+=("${optVar}=()")
    fi

    _argproc_define-multi-value-arg --rest \
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

    local specName desc
    for specName in "$@"; do
        _argproc_preReturnStatements+=("$(
            printf '[[ ${_argproc_receivedArgNames} =~ "<%s>" ]] && (( _argproc_count++ )) || true' \
                "${specName}"
        )")

        desc="$(_argproc_arg-description --short "${specName}")" || return 1
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

    local specName="$1"
    local funcName="_argproc:arg-description-${specName}"
    local desc

    if ! declare -F "${funcName}" >/dev/null; then
        error-msg --file-line=1 "No such argument: <${specName}>"
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

# Defines an activation function for an alias and/or a short alias.
function _argproc_define-alias-arg {
    local shortOnly=0
    case "$1" in
        --option)
            : # Nothing special to do for this case.
            ;;
        --short-only)
            shortOnly=1
            ;;
        *)
            error-msg --file-line=1 'Need --option or --short-only.'
            return 1
            ;;
    esac
    shift

    local specName="$1"
    local specShort="$2"
    shift 2
    local args=("$@")

    if (( !shortOnly )); then
        _argproc_set-arg-description "${specName}" option || return 1

        local desc="$(_argproc_arg-description "${specName}")"
        local handlerName="_argproc:alias-${specName}"
        eval 'function '"${handlerName}"' {
            if (( $# > 0 )); then
                error-msg "Value not allowed for '"${desc}"'."
                return 1
            fi
            printf "%q\\n" '"$(_argproc_quote "${args[@]}")"'
        }'
    fi

    if [[ ${specShort} != '' ]]; then
        eval 'function _argproc:short-alias-'"${specShort}"' {
            echo --'"${specName}"'
        }'
    fi
}

# Defines an activation function for a multi-value argument.
function _argproc_define-multi-value-arg {
    local isOption=0 isRest=0
    if [[ $1 == '--option' ]]; then
        isOption=1
        shift
    elif [[ $1 == '--rest' ]]; then
        isRest=1
        shift
        if declare >/dev/null -F _argproc:rest; then
            error-msg --file-line=2 'Duplicate definition of rest argument.'
            return 1
        fi
    fi

    local specName="$1"
    local filter="$2"
    local callFunc="$3"
    local varName="$4"

    if (( isOption )); then
        _argproc_set-arg-description "${specName}" multi-option || return 1
        handlerName="_argproc:long-${specName}"
    elif (( isRest )); then
        _argproc_set-arg-description "${specName}" rest-argument || return 1
        handlerName='_argproc:rest'
    else
        _argproc_set-arg-description "${specName}" multi-argument || return 1
        handlerName="_argproc:positional-${specName}"
    fi

    local handlerBody="$(
        _argproc_handler-body "${specName}" "${filter}" "${callFunc}" "${varName}"
    )"

    eval 'function '"${handlerName}"' {
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

    local specName="$1"
    local value="$2"
    local callFunc="$3"
    local varName="$4"
    local specShort="$5"

    _argproc_set-arg-description "${specName}" option || return 1

    local desc="$(_argproc_arg-description "${specName}")"
    local handlerName="_argproc:long-${specName}"
    local handlerBody="$(
        _argproc_handler-body "${specName}" '' "${callFunc}" "${varName}"
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

    if [[ ${specShort} != '' ]]; then
        _argproc_define-alias-arg --short-only "${specName}" "${specShort}"
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

    local specName="$1"
    local eqDefault="$2"
    local filter="$3"
    local callFunc="$4"
    local varName="$5"

    local handlerName
    if (( isOption )); then
        _argproc_set-arg-description "${specName}" option || return 1
        handlerName="_argproc:long-${specName}"
    else
        _argproc_set-arg-description "${specName}" argument || return 1
        handlerName="_argproc:positional-${specName}"
    fi

    local desc="$(_argproc_arg-description "${specName}")"
    local handlerBody="$(
        _argproc_handler-body "${specName}" "${filter}" "${callFunc}" "${varName}"
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
        elif (( $# > 1 )); then
            error-msg "Too many values for '"${desc}"'."
            return 1
        fi
        '"${handlerBody}"'
    }'

    if [[ ${specShort} != '' ]]; then
        _argproc_define-alias-arg --short-only "${specName}" "${specShort}"
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
    local specName="$1"
    local filter="$2"
    local callFunc="$3"
    local varName="$4"
    local result=()

    if [[ ${filter} =~ ^/(.*)/$ ]]; then
        # Add a call to perform the regex check on each argument.
        filter="${BASH_REMATCH[1]}"
        local desc="$(_argproc_arg-description "${specName}")"
        result+=("$(printf \
            '_argproc_regex-filter-check %q %q "$@" || return "$?"\n' \
            "${desc}" "${filter}"
        )")
    elif [[ ${filter} != '' ]]; then
        # Add a loop to call the filter function on each argument.
        result+=(
            "$(printf '
                local _argproc_value _argproc_args=()
                for _argproc_value in "$@"; do
                    _argproc_args+=("$(%s "${_argproc_value}")") || return 1
                done
                set -- "${_argproc_args[@]}"' \
                "${filter}")"
        )
    fi

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
        "$(printf '_argproc_receivedArgNames+="<%s>"' "${specName}")"
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
    local gotDefault=0
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
                default)
                    gotDefault=1
                    [[ ${value} =~ ^=(.*)$ ]] \
                    && optDefault="${BASH_REMATCH[1]}" \
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
    elif (( gotDefault && optRequired )); then
        # Special case: `--default` is meaningless if `--required` was passed.
        error-msg --file-line=2 'Cannot use both --required and --default.'
        _argproc_declarationError=1
        return 1
    elif (( gotDefault )) && [[ ${optVar} == '' ]]; then
        # Special case: `--default` is meaningless without `--var`.
        error-msg --file-line=2 'Must use --var when --default is used.'
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

# Parses a single argument / option spec. `--short` to accept a <short>
# (short-option) character. `--value` to accept a value. `--value-eq` to accept
# a value and leave the `=` in the result (to distinguish unset and
# set-to-empty). Sets `spec<Item>` (presumed locals in the calling scope) to
# "return" results.
function _argproc_parse-spec {
    local shortOk=0
    local valueOk=0
    local valueWithEq=0
    while [[ $1 =~ ^-- ]]; do
        case "$1" in
            --short)    shortOk=1               ;;
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

    specName="${BASH_REMATCH[1]}" # Name always allowed. Others must be checked.
    local shortChar="${BASH_REMATCH[2]}"
    local value="${BASH_REMATCH[3]}"

    if (( shortOk )); then
        specShort="${shortChar#/}" # `#/` to drop the initial slash.
    elif [[ ${shortChar} != '' ]]; then
        error-msg --file-line=2 "Short-option character not allowed in spec: ${spec}"
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
    local specName="$1"
    local typeName="$2"

    local funcName="_argproc:arg-description-${specName}"

    if declare -F "${funcName}" >/dev/null; then
        error-msg --file-line=3 "Duplicate argument declaration: ${specName}"
        _argproc_declarationError=1
        return 1
    fi

    local desc
    case "${typeName}" in
        argument)
            desc="argument <${specName}>"
            ;;
        multi-argument)
            desc="argument <${specName}[]>"
            ;;
        multi-option)
            desc="option --${specName}[]"
            ;;
        option)
            desc="option --${specName}"
            ;;
        rest-argument)
            desc="rest argument <${specName}...>"
            ;;
        *)
            error-msg --file-line=1 "Unknown argument type: ${typeName}"
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
# declared `local` by its caller.
#
# Note: This arrangement, where argument parsing is done in a separate
# function and as a separate pass from evaluation, makes it possible to use
# non-mangled local variables in the more tricky code, so it's a bit nicer to
# read.
function _argproc_statements-from-args {
    local argError=0
    local arg handler name assign value values

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
        elif [[ ${arg} =~ ^--([-a-zA-Z0-9]+)(('[]='|=)(.*))?$ ]]; then
            # Long-form option.
            name="${BASH_REMATCH[1]}"
            assign="${BASH_REMATCH[3]}"
            value="${BASH_REMATCH[4]}"
            if handler="_argproc:long-${name}" \
                    && declare -F "${handler}" >/dev/null; then
                case "${assign}" in
                    '')
                        # No-value option.
                        _argproc_statements+=("${handler}")
                        ;;
                    '=')
                        # Single-value option.
                        _argproc_statements+=(
                            "${handler} $(_argproc_quote "${value}")")
                        ;;
                    '[]=')
                        # Multi-value option. Parse the value into elements.
                        if eval 2>/dev/null "values=(${value})"; then
                            _argproc_statements+=(
                                "${handler} $(_argproc_quote "${values[@]}")")
                        else
                            error-msg "Invalid multi-value syntax for option --${name}:"
                            error-msg "  ${value}"
                            argError=1
                        fi
                        ;;
                esac
            elif handler="_argproc:alias-${name}" \
                    && declare -F "${handler}" >/dev/null; then
                # Alias option; must not be passed any values.
                if [[ ${assign} == '' ]]; then
                    # Parse the output of `handler` into new options, and
                    # "unshift" them onto `$@`.
                    if eval 2>/dev/null "values=($("${handler}"))"; then
                        shift # Shift the alias option away.
                        set -- shifted-away-below "${values[@]}" "$@"
                    else
                        error-msg "Could not expand alias option: --${name}"
                        argError=1
                    fi
                else
                    error-msg "Cannot pass values to alias option: --${name}"
                    argError=1
                fi
            else
                error-msg "Unknown option: --${name}"
                argError=1
            fi
        elif [[ $arg =~ ^-([a-zA-Z0-9]+)$ ]]; then
            # Short-form option (which is always an alias in this system).
            arg="${BASH_REMATCH[1]}"
            local newArgs=()
            while [[ ${arg} =~ ^(.)(.*)$ ]]; do
                name="${BASH_REMATCH[1]}"
                arg="${BASH_REMATCH[2]}"
                if handler="_argproc:short-alias-${name}" \
                        && declare -F "${handler}" >/dev/null; then
                    # Parse the output of `handler` into new options to include.
                    if eval 2>/dev/null "values=($("${handler}"))"; then
                        newArgs+=("${values[@]}")
                    else
                        error-msg "Could not expand alias option: --${name}"
                        argError=1
                    fi
                else
                    error-msg "Unknown option: -${name}"
                    argError=1
                    # Break, to avoid spewing a ton of errors in case of a pilot
                    # error along the lines of `-longOptionName`.
                    break
                fi
            done
            shift # Shift the original short option away.
            set -- shifted-away-below "${newArgs[@]}" "$@"
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
