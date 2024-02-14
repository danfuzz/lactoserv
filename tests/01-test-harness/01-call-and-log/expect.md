## no output; success

### exit: 0

- - - - - - - - - -

## no output; error

### exit: 1

- - - - - - - - - -

## stdout without nl; success

### stdout
```
hello
```
(no newline at end)

### exit: 0

- - - - - - - - - -

## stdout; success

### stdout
```
hello
```

### exit: 0

- - - - - - - - - -

## stderr without nl; fail

### stderr
```
eek
```
(no newline at end)

### exit: 127

- - - - - - - - - -

## stderr; fail

### stderr
```
eek
```

### exit: 255

- - - - - - - - - -

## stdout and stderr

### stdout
```
hello
```

### stderr
```
eek
```

### exit: 0

- - - - - - - - - -

## stdout and stderr, two lines without final nl

### stdout
```
hello
hi
```
(no newline at end)

### stderr
```
eek
oy
```
(no newline at end)

### exit: 0

- - - - - - - - - -

## stdout and stderr, two lines

### stdout
```
hello
hi
```

### stderr
```
eek
oy
```

### exit: 0

- - - - - - - - - -

## stdout and stderr, two lines and extra nl at end

### stdout
```
hello
hi

```

### stderr
```
eek
oy

```

### exit: 0

- - - - - - - - - -

## stdout and stderr, two lines and extra nl at start

### stdout
```

hello
hi
```

### stderr
```

eek
oy
```

### exit: 0
