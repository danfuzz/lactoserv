Coding Conventions
==================

Much of the basic coding conventions are enforced by the linter (e.g.
indentation, string quotes, JSDoc annotations). See the ESLint config file for
details.

Similarly, `import` ordering is maintained with `ubik node-project
sort-imports`, which you can run if you're ever in need of some automated help.
The basic idea is that imports go from "general" to "specific" with an extra
newline between each related section.

And for documentation comments, `ubik node-project reflow-jsdoc` will help keep
those comments neat and tidy.

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

    _impl_method() { ... }
    ...
    _prot_method() { ... }
    ...

    get #privateAccessor() { ... }
    #privateMethod() { ... }
    ...

    //
    // Static members
    //

    ... same order as instance members, plus ...

    static InnerClass = class InnerClass { ... }
    ...
}
```

#### Default constructors

In order to make it clear that the omission of a constructor is intentional,
use the following comment in place of an intentionally omitted constructor:

```js
  // @defaultConstructor
```

### Class naming (and details)

* `Base<Name>` &mdash; An abstract base class. Method bodies to be filled in
  by subclasses (see `_impl_<name>` below) should make calls to
  `Methods.abstract(...)` to avoid incomplete subclassing.

* `Intf<Name>` &mdash; An interface, just to be used with `@interface` and
  `@implements` annotations, and declared as the types of variables and
  properties. As with base classes, use `Methods.abstract(...)` to prevent
  accidental usage.

* `Templ<Name>` &mdash; A "template class," which in this case really means a
  factory function for classes, which has arguments for each of the template
  variables.

* `Type<Name>` &mdash; A `@typedef` declaration, just to be used to annotate
  method arguments, class properties, etc.

* `<Name>Config` &mdash; A configuration class of some sort. These are typically
  parsed from plain objects and can be passed as arguments to many constructors.
  Notably, the `compy` component framework requires their use.

* `<Name>Util` &mdash; A "utility" class which is not meant to be instantiated,
  and which only contains `static` methods.

### Member naming (and details)

* `_config_<name>` &mdash; Method defined by configuration classes which are
  (direct or indirect) subclasses of `structy.BaseConfig`. Each such method
  is responsible for validating and parsing/converting the correspondingly named
  property of a plain-object configuration.

* `_impl_<name>` &mdash; Declared in base classes, _either_ as abstract and left
  for subclasses to fill in (as specified by the base class), or with a
  reasonable default implementation. _Not_ supposed to be called except by the
  defining base class (not even subclasses). These are more or less `protected`
  and methods declared by a base class, often (but not always) also `abstract`.

* `_prot_<name>` &mdash; Defined in base classes and _not_ to be overridden. To
  be called by subclasses; _not_ supposed to be used outside of the class. These
  are more or less `protected final` methods defined by a base class.

* `_struct_<name>` &mdash; Method defined by struct classes which are (direct or
  indirect) subclasses of `structy.BaseStruct`. Each such method is
  responsible for validating and parsing/converting the correspondingly named
  property of a plain-object configuration.

* `_testing_<name>` &mdash; Methods whose sole purpose is to do instance
  introspection (and generally, break encapsulation) in order to make unit
  testing a little less painful.

With very few exceptions, members _not_ marked with `_impl_` should be treated
as effectively `final`, that is, not to be overridden.

### Ledger of arbitrary decisions

Every enduring project of nontrivial size ends up having the results of myriad
small and mostly inconsequential decisions embedded in it. This section is
meant to record them, in order to keep track of them and maintain consistency.

* Anything that is complained about by the linter is a problem to be fixed
  before merging to `main`.

* The string `'utf-8'` is the way to refer to the UTF-8 encoding. Context: Node
  historically prefers `'utf8'`, but web standards seem to prefer `'utf-8'`.
  Node generally accepts both, and so we go with the latter.

* If a code block (including a full method body) is intentionally empty, and
  there's no more-specific comment to be made, the block should include a single
  line with the following comment:

  ```js
  // @emptyBlock
  ```

* Terminology:
  * Use "HTTP1" or "HTTP1-ish" to refer to the HTTP1 family of protocols. (No
    other punctuation variants.)
  * Similarly, use "HTTP2" or "HTTP2-ish" for the HTTP2 protocol.
  * Likewise, use "HTTP-ish" to refer to any HTTP protocol (or similar).

- - - - - - - - - -
```
Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
