`lactoserv` Web Server
======================

[![Require Lint](https://github.com/danfuzz/lactoserv/actions/workflows/main.yml/badge.svg)](https://github.com/danfuzz/lactoserv/actions/workflows/main.yml)

- - - - - - - - - -
This is a web server which knows how to serve a couple different types of
(more or less) static site.

- - - - - - - - - -

## Coding convention notes

### Canonical order of items in a class declaration

```javascript
import * as builtIn from 'node:built-in-module';
...

import * as something from 'npm-sourced-module';
...

import { SomeOtherClass } from '@this/this-codebase';
...

import { SomeClassInThisModule } from '#p/SomeClassInThisModule';
...


class Florp {
    #privateField;
    ...

    constructor() { ... }

    get publicAccessor() { ... }
    set publicAccessor() { ... }
    get anotherPublic() { ... }
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

Notes:

* Import order is "outer to inner" (or "ubiquitous to module-specific") with an
  extra newline between sections.
