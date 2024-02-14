## Match

### Metadata

* Status: got 200, expected 304
* Status text: got OK, expected Not Modified
* Header content-length
  * got '637'
  * unexpected
* Header content-type
  * got 'text/html; charset=utf-8'
  * unexpected
* Header last-modified
  * got 'Mon, 12 Feb 2024 22:35:02 GMT'
  * unexpected

### Body

```
<!DOCTYPE html>
<html>
<head>
    <title>Hello!</title>
</head>
<body>
    <h1>Hello!</h1>
</body>

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

</html>
```
