Coding Conventions
==================

Much of the basic coding conventions are enforced by the linter (e.g.
indentation, string quotes, JSDoc annotations). See the ESLint config file for
details.

Similarly, `import` ordering is maintained with `scripts/sort-imports`, which
you can run if you're ever in need of some automated help. The basic idea is
that imports go from "general" to "specific" with an extra newline between each
related section.

- - - - - - - - - -

### Canonical order of items in a class declaration

Other than direct fields (instance / static variables), each section of
a class declaration is expected to be sorted alphabetically, unless there's a
readability-related reason not to. Order of sections:

```javascript
export class Florp {
    #privateField;
    ...

    constructor() { ... }

    get publicAccessor() { ... }
    set publicAccessor() { ... }
    ...

    publicMethod() { ... }
    ...

    get #privateAccessor() { ... }
    #privateMethod() { ... }
    ...


    //
    // Static members
    //

    static #privateField;
    ...

    static get publicAccessor() { ... }
    ...

    static publicMethod() { ... }
    ...

    static get #privateAccessor() { ... }
    ...

    static #privateMethod() { ... }
    ...
}
```

### Class naming (and details)

* `Base<Name>` -- An abstract base class. Method bodies should use
  `Methods.abstract(...)` to avoid accidental direct instantiation.

* `Intf<Name>` -- An interface, just to be used with `@interface` and
  `@implements` annotations, and declared as the types of variables and
  properties. As with base classes, use `Methods.abstract(...)` to prevent
  accidental usage.

* `Type<Name>` -- A `@typedef` declaration, just to be used to annotate method
  arguments, class properties, etc.,

### Method naming (and details)

* `_impl_<name>` -- Declared in base classes as abstract, and left for
  subclasses to fill in (as specified by the base class). _Not_ supposed to be
  called except by the defining base class (not even subclasses). These are more
  or less `protected abstract` methods declared by a base class.

* `_prot_<name>` -- Defined in base classes and _not_ to be overridden. To be
  called by subclasses; _not_ supposed to be used outside of the class. These
  are more or less `protected final` methods defined by a base class.

- - - - - - - - - -
```
Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
