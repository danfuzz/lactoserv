## Top index

### Metadata

* No problems.

### Body

```
<!DOCTYPE html>
<html>
<head>
  <title>Hello!</title>
</head>

<body>
  <h1>Hello!</h1>
  <ul>
    <li><a href="avec-index">avec-index/</a></li>
    <li>florp/
      <ul>
        <li><a href="florp/boop.html">boop.html</a></li>
      </ul>
    </li>
    <li>resp/
      <ul>
        <li><a href="resp/empty-body">empty-body</a></li>
        <li><a href="resp/no-body">no-body</a></li>
        <li><a href="resp/one">one</a></li>
        <li><a href="resp/two">two</a></li>
      </ul>
    </li>
    <li>subdir/
      <ul>
        <li><a href="subdir/one.txt">one.txt</a></li>
        <li><a href="subdir/two.txt">two.txt</a></li>
      </ul>
    </li>
  </ul>
</body>

</html>
```

## Redirect from non-directory path

### Metadata

* No problems.

### Body

Body is as expected.

## Subdirectory index

### Metadata

* No problems.

### Body

```
<!DOCTYPE html>
<html>

<head>
  <title>Subdir!</title>
</head>

<body>
  <h1>Subdir!</h1>
</body>

</html>
```

## Subdirectory file

### Metadata

* No problems.

### Body

```
one
```
