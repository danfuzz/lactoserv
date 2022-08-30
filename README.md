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
import { SomeClass } from '#p/this-package';
...

import { SomeOtherClass } from '@this/this-codebase';
...

import * as something from 'npm-sourced-package';
...

import * as builtIn from 'node:built-in-package';
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
