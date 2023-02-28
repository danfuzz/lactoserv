@this/data-values
=================

Handling of "data values," that is, simple values and compound objects that
ultimately just represent simple data (and not, in particular, objects with
"behavior").

For the purposes of this module, "data values" are a superset of what can be
represented in JSON and are intended to be (ultimately) a superset of what
JavaScript defines as "serializable" values, though with a bit of a twist. Here
is a run-down of what is covered:

* `undefined`.
* `null`.
* booleans.
* strings.
* symbols.
* finite numbers of JavaScript types `number` or `bigint`.
* non-finite numbers `+Infinity`, `-Infinity`, and `NaN`.
* arrays, without symbol bindings; may be sparse _and_ may have non-index
  bindings.
* plain objects, without symbol bindings.
* instances of class `Struct` (which is defined in this module). See below for
  details.
* instances of class `Ref` (which is defined in this module). This is
  effectively an "escape hatch" to allow arbitrary objects to pass through a
  data value conversion without being touched.

The `Struct` class is particularly of note. It is the key class used to enable
general representation of instances as data. On the way into a data value form,
a supported instance gets "deconstructed" into a `Struct` instance, after which
it may be serialized as appropriate for the context. Then later, a (presumably
recently) unserialized data value can get processed in a context that
understands some set of `Struct`-able types, and proceed to reconstitute new
objects that are (sufficiently) equivalent to the originals. The "twist"
mentioned above about serializable values is that, while the classes designated
by JavaScript to be serializable mostly don't appear in the list of covered data
values above, many (and ultimately, one hopes, all) are covered by special case
conversion to `Struct` instances.

Beyond the built-in special cases, and similar to how `JSON.stringify()`
knows to look for a `.toJSON()` method, this class understands the symbol-named
method `BaseConverter.ENCODE` to define an instance-specific value-encoding
behavior. The expectation is that most such custom converters end up producing
`Struct` instances (though that isn't strictly required).

This module includes a small handful of general low-ish-level classes that
"play nice" with `BaseConverter.ENCODE`, including notably `StackTrace`.

**Note:** This module is intended to handle both encoding and decoding of
values, but as of this writing decoding is not yet needed. So, that
functionality is merely hinted at and stubbed out.

- - - - - - - - - -
```
Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
