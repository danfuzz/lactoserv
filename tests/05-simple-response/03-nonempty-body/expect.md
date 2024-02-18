## Unconditional

### Metadata

* No problems.

### Body

```
One!
```

## Unconditional, `HEAD` request

### Metadata

* No problems.

### Body

No body, as expected.

## ETag conditional, matching

### Metadata

* No problems.

### Body

No body, as expected.

## ETag conditional, unmatching

### Metadata

* No problems.

### Body

Body is as expected.

## Range request, unconditional

### Metadata

* No problems.

### Body

```
ne```

## Range request, ETag conditional which should not match because the tag is weak

### Metadata

* No problems.

### Body

Body is as expected.
