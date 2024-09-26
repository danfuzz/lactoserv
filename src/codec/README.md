@this/codec
===========

Handling of "data coding," that is, mechanisms to encode (potentially) arbitrary
data-bearing JavaScript values into a consistent form and decode the consistent
form back into (potentially) arbitrary JavaScript values. This module aims to
define a minimal-yet-useful API (including classes) to achieve the stated goal.

The encoding and decoding in this module treats non-object JavaScript values
transparently. In addition, it handles:

* arrays, without symbol bindings; may be sparse _and_ may have non-index
  bindings.
* plain objects, without symbol bindings.

This module uses two specific classes to handle the conversion of instances
(that is, objects with a class or class-ish prototype), `Ref` and `Sexp`.

`Ref` is effectively an "escape hatch" to allow arbitrary objects to pass
through a conversion without being touched.

`Sexp` is the key class used to enable general representation of instances as
data. On the way into a consistent encoded form, a supported instance gets
"deconstructed" into a `Sexp` instance, after which it may be serialized as
appropriate for the context. Then later, an unserialized consistent-form data
value can get processed in a context that understands some set of `Sexp`-able
types, and proceed to reconstitute new objects that are (sufficiently)
equivalent to the originals. Note that, while the classes designated by
JavaScript to be serializable mostly aren't directly handled by the general
codec code, many (and ultimately, one hopes, all) are covered by special case
conversion to and from `Sexp` instances.

Beyond the built-in special cases, and similar to how `JSON.stringify()`
knows to look for a `.toJSON()` method, this class understands the symbol-named
method `BaseCodec.ENCODE` to define an instance-specific value-encoding
behavior. The expectation is that most such custom converters end up producing
`Sexp` instances (though that isn't strictly required).

This module includes a small handful of general low-ish-level classes that
"play nice" with `BaseCodec.ENCODE`, including notably `StackTrace`.

**Note:** This module is intended to handle both encoding and decoding of
values, but as of this writing decoding is not yet implemented. So, that
functionality is merely hinted at and stubbed out.

- - - - - - - - - -
```
Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
