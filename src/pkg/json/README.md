@this/json
==========

Stuff for dealing with JSON.

- - - - - - - - - -

## `JsonExpander` Built-In Directives

### `{ $defs: { <key>: <value>, ... } }`

This is recognized as a top-level binding, providing a set of definitions that
can be referenced in the rest of the value (or within the definitions
themselves). The expanded result is the _remaining_ bindings, without the
original `$defs`. See `$ref` for more details.

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
