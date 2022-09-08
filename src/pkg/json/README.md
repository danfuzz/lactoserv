@this/json
==========

Stuff for dealing with JSON.

- - - - - - - - - -

## `JsonExpander` Built-In Directives

### `{ $baseDir: "<path>", ... }`

This defines an absolute base directory in the filesystem, which other
filesystem-using directives can use when encountering relative paths. `<path>`
must start with a slash (`/`) and _not_ end with a slash (`/`). The expanded
result is the _remaining_ bindings in the object in which the directive appears,
but without the original directive binding.

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
