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
class Florp {
    #privateField;
    ...

    constructor() { ... }

    get accessor() { ... }
    set accessor() { ... }
    get another() { ... }
    ...

    publicMethod() { ... }
    ...

    #privateMethod() { ... }
    ...

    //
    // Static members
    //

    static #privateField;
    ...

    static publicMethod() { ... }
    ...

    static #privateMethod() { ... }
    ...
}
```
