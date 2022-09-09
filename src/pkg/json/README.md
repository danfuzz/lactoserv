@this/json
==========

Stuff for dealing with JSON.

- - - - - - - - - -

## `JsonExpander` Built-In Directives

### `{ $await: <function-or-promise> }`

This defines a deferred computation to be inserted into the expanded value.
`<function-or-promise>` should in fact be a function (of no arguments) or
a promise; notably this means that the binding here isn't JSON data per se
(though it's expected to resolve to it). The expanded result is in fact
whatever the promise or the return value from the call resolves to. If the
promise is rejected or the call throws, then the expansion will fail.

This directive may not be used in expansions that run synchronously.

**Note:** This directive can be used in service of implementing other
directives that wish to operate asynchronously, so that those directives can
avoid (re)implementing much of the semantics.

### `{ $baseDir: "<path>", ... }`

This defines an absolute base directory in the filesystem, which other
filesystem-using directives can use when encountering relative paths. The
expanded result is the _remaining_ bindings in the object in which the directive
appears, but without the original directive binding.

Requirements for `<path>`:

* It must start with a slash (`/`).
* It must _not_ end with a slash (`/`) unless the entire path is just `/`.
* It must not contain any double-slashes (or triples, etc.), e.g. not `/x//y`.
* It must not contain `.` or `..` as a path component.

This is recognized as a top-level binding _only_, and is an error everywhere
else.

```json
{
  "a": [1, 2, 3],
  "$baseDir": "/home/danfuzz"
}

=>

{
  "a": [1, 2, 3]
}
```

### `{ $defs: { <key>: <value>, ... }, ... }`

This provides a set of definitions that can be referenced in the rest of
the value (or within the definitions themselves). The expanded result is the
_remaining_ bindings in the object in which the directive appears, but without
the original directive binding.

This is recognized as a top-level binding _only_, and is an error everywhere
else.

See `$ref` for details about how this directive gets used.

```json
{
  "a": [1, 2, 3],
  "$defs": {
    "like": "florp"
  }
}

=>

{
  "a": [1, 2, 3]
}
```

### `{ $quote: <value> }`

This quotes a value literally, preventing any expansion to be done in the value.
It's useful if one needs to represent data that _might_ (or definitely _does_)
contain bindings that would otherwise be recognized as directives, in a context
where that recognition is undesirable.

```json
{
  "$quote": {
    "$ref": "Not really."
  }
}

=>

{
  "$ref": "Not really."
}
```

### `{ $readFile: "<path>", ?type: "<type>" }`

This provides a way to include the contents of another file as an expanded
value. `<path>` is a filesystem path, which is expected to point at a regular
file (an existing non-directory). If `<path>` is relative, it is resolved
against the base directory specified by a top-level `$baseDir` directive (which
must in fact be included in the original value to be expanded).

The optional `type` binding specifies the type of the file (affecting its
processing):

* `text` (the default) -- The file is simply read as text. A string of its
  contents is the expanded result.
* `json` -- The file is parsed as JSON. The parsed JSON value is then expanded
  in a fresh environment configured with the same directives, but with an
  implied `$baseDir` that refers to the director that the file is in.
* `rawJson` -- The file is parsed as JSON. The parsed JSON value (with no
  further processing) is the expanded result.

**Note:** This directive always operates asynchronously.

### `{ $ref: "<path>" }`

This is a reference to a definition from a `$defs` directive. `<path>` must
be of the form `#/$defs/<key>`, where the prefix is mandatory exactly as shown
and `<key>` is one of the keys bound directly by the `$defs`. The expanded
result is (the expanded result of) the value at `$defs.<key>`.

**Note:** This form is patterned after the similar facility defined by JSON
Schema, though it is intentionally more restrictive. This will be loosened up if
and when there is an actual need.

```json
{
  "a": [1, 2, 3, { "$ref": "#/$defs/like" }],
  "$defs": {
    "like": "florp"
  }
}

=>

{
  "a": [1, 2, 3, "florp"]
}
```

### `{ $value: <value> }`

This provides a way to have a non-object value as the result in a context where
other directives are necessarily being used (especially at the top level). The
given value is simply processed and then becomes the result of expansion.

```json
{
  "$value": [1, 2, 3, { "$ref": "#/$defs/like" }],
  "$defs": {
    "like": "florp"
  }
}

=>

[1, 2, 3, "florp"]
```
