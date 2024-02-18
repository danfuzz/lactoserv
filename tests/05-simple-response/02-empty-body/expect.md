## Unconditional

### Metadata

* No problems.

### Body

Body is as expected.

## Unconditional, `HEAD` request

### Metadata

* No problems.

### Body

No body, as expected.

## Date conditional, matching

### Metadata

* No problems.

### Body

No body, as expected.

## Date conditional, non-matching

### Metadata

* No problems.

### Body

Body is as expected.

## Range request, which cannot possibly be satisfied (because empty!)

### Metadata

* No problems.

### Body

```
416 Range Not Satisfiable
```
