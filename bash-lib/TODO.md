TODO
====

TODO for `arg-processor`:
* Make `--enum=` allow for rewriting values, e.g.
  `--enum='1 0 yes=1 no=0 true=1 false=0'`.

* Allow multiple `--filter`s in definitions (not just internally).

* Add structured docs for options, to make usage message definition better.

* Add `pre-opt-positional-arg` to help make `aws-json` nicer. Or maybe something
  like: `arg-layout =<literal-text> <arg-name> <arg-name> opts:<set-name>
  <arg-name> <arg-name> =<literal-text> opts:<set-name>`

  Allow multiple of these. Use first match.

  `postitional-arg` will then work differently; won't add arguments to the
  parse; they'd have to be mentioned explicitly.)

* Add `opt-alias <alias> :: <expansion>` with short and non-value long options
  as possible alias names, e.g. `opt-alias -d :: --big-dogs --little-dogs
  --dog-size=any` or `opt-alias --all-rules :: --match='.'`.

* Add tests!

TODO for `stderr-messages`:

* Add tests!
