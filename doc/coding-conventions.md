Coding Conventions
==================

Much of the basic coding conventions are enforced by the linter (e.g.
indentation, string quotes, JSDoc annotation). See the ESLint config file for
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
