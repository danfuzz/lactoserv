Configuration Guide: Built-In Applications
==========================================

## Common Application Configuration

This section documents a handful of common properties and sub-objects that are
used when configuring services. The documentation for services that use these
indicate which (if any) apply.

See also [Common Configuration](./2-common-configuration.md) for configuration
details that apply to more than just applications.

### Cache control configuration: `cacheControl`

Applications and services that might generate `cache-control` headers accept
a `cacheControl` binding. When it is absent or `false`, no such headers are
automatically generated. When it _is_ specified, then (generally speaking) the
value is used as a response header value for `cache-control` whenever such a
header is allowed.

The `cacheControl` value can be specified as a simple string value for the
header (e.g, `'public, max-age=86400'`), or it can be specified as an object
with bindings for each of the values.

In object form, property names are the `camelCase` versions of the in-header
names (e.g. `noStore` for `no-store`). Values can be:

* For present-vs-absent header values, such as `public` and `no-cache`:
  * A `boolean`, in which case `true` includes the value and `false` omits it.
* For duration values:
  * A duration as described in [Durations](./2-common-configuration.md#durations).

### ETag Configuration: `etag`

Applications and services that generate ETags accept an `etag` binding. When it
is absent or `false` (if allowed), no ETags are generated. If it is specified as
`true` or `{}` (the empty object), ETags are generated using a default
configuration. If it is specified as an object with bindings, the following
properties are recognized:

* `dataOnly` &mdash; Boolean indicating whether _only_ entity data should be
  used to generate tags, as opposed to using metadata such as file names and
  modification times. When `true`, filesystem-based applications/services use
  file data. When `false`, they use metadata. Defaults to `false`.
* `hashAlgorithm` &mdash; Algorithm to use to generate hashes. Allowed to be
  `sha1`, `sha256`, or `sha512`. Defaults to `sha256`.
* `hashLength` Number of characters to use from a generated hash when producing
  a tag. To have different lengths for strong vs. weak tags, specify this as an
  object with `strong` and `weak` properties. In object form, a `null` mapping
  indicates that the full hash length is to be used. Defaults to `{ strong:
  null, weak: 16}`.
* `tagForm` What ETag form to produce (indicating the "strength" of the tag),
  one of `weak`, `strong`, or `vary`. "Strong" tags are meant to convey that the
  entire underlying data is hashed into the tag, and as such it is safe to make
  range requests if a tag matches. "Weak" tags are, on the other hand, intended
  to indicate that the data was not fully hashed into the tag. If passed as
  `vary`, tags are produced in the arguably-most-appropriate form. Defaults to
  `vary`.

## `HostRouter`

An application which can route requests to another application, based on the
`host` (or equivalent) header in the requests. This application accepts the
following configuration bindings:

* `hosts` &mdash; A plain object with possibly-wildcarded hostnames as keys, and
  the _names_ of other applications as values. A wildcard only covers the prefix
  of a hostname and cannot be used for hostnames identified by numeric IP
  address.

**Note:** Unlike `PathRouter`, this application does not do fallback to
less-and-less specific routes; it just finds (at most) one to route to.

```js
import { HostRouter } from '@lactoserv/webapp-builtins';

const applications = [
  {
    name:  'myHosts',
    class: HostRouter,
    hosts: {
      '*':             'myCatchAllApp',
      '127.0.0.1':     'myLocalhostApp',
      'localhost':     'myLocalhostApp',
      '*.example.com': 'myExampleApp'
    }
  },
  {
    name: 'myCatchallApp',
    // ... more ...
  },
  {
    name: 'myExampleApp',
    // ... more ...
  },
  {
    name: 'myLocalhostApp',
    // ... more ...
  }
];
```

## `PathRouter`

An application which can route requests to another application, based on the
path of the requests. This application accepts the following configuration
bindings:

* `paths` &mdash; A plain object with possibly-wildcarded paths as keys, and
  the _names_ of other applications as values. A wildcard only covers the suffix
  of a path; it cannot be used for prefixes or infixes. Wildcards are indicated
  with the path suffix `/*`.

The keys in `paths` must start with a slash (`/`). (The idea is that they are
_absolute_ paths within the scope of the router, even though they are
effectively _relative_ paths with respect to whatever the router is mounted
within.) The components within paths are required to adhere to the normal syntax of URIs,
with the following additional restrictions:

* No path components consisting solely of one or more asterisks (`*`), to avoid
  confusion with wildcards.
* No empty path components (`...//...`). It's too confusing.
* No "directory navigation" components, that is, `.` or `..`. They couldn't
  ever be matched anyway, because of URI canonicalization.

See [RFC 3986 section 3.3](https://datatracker.ietf.org/doc/html/rfc3986#section-3.3)
for the full syntax of URI paths.

The routing works by starting with the most specific match to the path of an
incoming request. If that app does not try to handle the request &mdash;
note that it counts as a "try" to end up `throw`ing out of the handler &mdash;
the next most specific match is asked, and so on, until there are no path
matches left.

```js
import { PathRouter } from '@lactoserv/webapp-builtins';

const applications = [
  {
    name:  'myPaths',
    class: PathRouter,
    paths: {
      '/*':         'myCatchAllApp',
      '/file':      'myFileApp',
      '/dir/':      'myDirApp',
      '/general/*': 'myGeneralApp',
    }
  },
  {
    name: 'myCatchallApp',
    // ... more ...
  },
  {
    name: 'myFileApp',
    // ... more ...
  },
  {
    name: 'myDirApp',
    // ... more ...
  },
  {
    name: 'myGeneralApp',
    // ... more ...
  }
];
```

## `Redirector`

An application which responds to all requests with an HTTP "redirect" response.
This application accepts the following configuration bindings:

* `acceptMethods` &mdash; Common configuration option, but in this case the
  default is `['delete', 'get', 'head', 'patch', 'post', 'put']`.
* `statusCode` &mdash; Optional HTTP status code to respond with. If not
  specified, it defaults to `301` ("Moved Permanently").
* `target` &mdash; The base URL to redirect to. This is prepended to the partial
  path of each request to form the final redirection URL.
* `cacheControl` &mdash; `cache-control` header definition. If present and not
  `false`, every cacheable response comes with the specified header.

```js
import { Redirector } from '@lactoserv/webapp-builtins';

const applications = [
  {
    name:          'myRedirector',
    class:         Redirector,
    statusCode:    308,
    target:        'https://example.com/boop/',
    cacheControl:  { public: true, maxAge: '5 min' },
    acceptMethods: ['head', 'get']
  }
];
```

## `RequestFilter`

An application which filters requests that match particular criteria, either by
responding with a particular "not-found-ish" status, or by redirecting to a
modified path.

When a request matches one or more filter criteria, this application responds
with a status code to indicate the filtering (by default `404`). When it
redirects, it uses status `308` ("Permanent Redirect"). In other cases &mdash;
that is, when the request is not filtered out &mdash; this application returns
`null`, meaning that it did not handle the request. This is done so that a
filter can be included early in the list of applications of a
[`SerialRouter`](#serialrouter).

This application accepts the following configuration bindings:

* `acceptMethods` &mdash; Array of strings indicating which request methods to
  accept. The array can include any of `connect`, `delete`, `get`, `head`,
  `options`, `patch`, `post`, `put`, and/or `trace`. Defaults to the entire set.
* `filterResponseStatus` &mdash; Status to report when a request has been
  filtered out (as opposed to having been redirected). Defaults to `404` ("Not
  Found").
* `maxPathDepth` &mdash; Number indicating the maximum (inclusive) allowed
  length _in path components_ of a dispatched request path not including the
  mount point, and not including the empty path component at the end of a
  directory path. `null` indicates "no limit." Defaults to `null`.
* `maxPathLength` &mdash; Number indicating the maximum (inclusive) allowed
  length of the dispatched request path _in octets_. `null` indicates "no
  limit." `0` indicates that no additional path is ever accepted (including even
  a directory slash). Defaults to `null`.
* `maxQueryLength` &mdash; Number indicating the maximum (inclusive) allowed
  length of the query (a/k/a "search") portion of a request URI _in octets_,
  including the leading question mark (`?`). `null` indicates "no limit." `0`
  indicates that queries are not ever accepted. Defaults to `null`.
* `redirectDirectories` &mdash; Boolean indicating whether or not directory
  paths (those ending with an empty path component) should be automatically
  redirected to the file (non-directory) version of the path. Defaults to
  `false`.
* `redirectFiles` &mdash; Boolean indicating whether or not file paths (those
  not ending with an empty path component) should be automatically redirected to
  the directory version of the path. Defaults to `false`.
* `rejectDirectories` &mdash; Boolean indicating whether or not directory paths
  (those ending with an empty path component) should be filtered out. Defaults
  to `false`.
* `rejectFiles` &mdash; Boolean indicating whether or not file paths (those
  not ending with an empty path component) should be filtered out. Defaults to
  `false`.

With regards to the `redirect*` and `reject*` options:
* It is an error to specify more than one as `true`. (It basically makes no
  sense to do so.)
* A redirection (or not) is entirely based on the form of the path &mdash;
  that is, whether or not it ends with a slash &mdash; and not on any other
  test. Notably, as opposed to this class, [`StaticFiles`](#staticfiles)
  performs _content_-driven redirection.

With regards to `maxPath*` options, note that these options are not meaningful
for applications that are mounted at fixed paths (e.g. within a
[`PathRouter`](#pathrouter) at a non-wildcard path).

With regards to the other options, when a request is filtered out, the result is
that the application simply _doesn't handle_ the request, meaning that the
request will get re-dispatched to the next application in its routing chain (if
any).

**Note:** This application is meant to cover a good handful of common use cases.
It is _not_ meant to be a "kitchen sink" of filtering. For filtering cases
beyond what's covered here, the best option is to define a custom application
class. That said, feature requests to add filtering options to this class will
be seriously considered, should they meet a bar of "reasonably useful across
many use cases."

```js
import { RequestFilter } from '@lactoserv/webapp-core';

const applications = [
  {
    name:                'myFilter',
    class:               RequestFilter,
    acceptMethods:       ['get', 'head'],
    maxQueryLength:      0,
    redirectDirectories: true
  }
];
```

## `SerialRouter`

An application which routes requests to one of a list of applications, which are
tried in order. (This is the default / built-in routing strategy of the most
common Node web application frameworks.) This application accepts the following
configuration bindings:

* `applications` &mdash; An array listing the _names_ of other applications as
  values.

The routing works by starting with the first element of `applications`, asking
it to handle an incoming request. If that app does not try to handle the request
&mdash; note that it counts as a "try" to end up `throw`ing out of the handler
&mdash; the next application in the list is asked, and so on, until the final
one has been tried.

```js
import { SerialRouter } from '@lactoserv/webapp-builtins';

const applications = [
  {
    name:         'mySeries',
    class:        SerialRouter,
    applications: ['firstApp', 'secondApp']
  },
  {
    name: 'firstApp',
    // ... more ...
  },
  {
    name: 'secondApp',
    // ... more ...
  }
];
```

## `SimpleResponse`

An application which only ever sends one particular response. It's approximately
like `StaticFiles`, except just one file. This application accepts the following
configuration bindings:

* `acceptMethods` &mdash; Common configuration option, but in this case the
  default is `['get', 'head']`.
* `body` &mdash; Optional body contents to respond with. If specified, this must
  be either a string or a Node `Buffer` object.
* `contentType` &mdash; Content type to report. This can be either a MIME type
  per se (e.g. `text/plain`) or a commonly-understood extension (with leading
  dot, e.g., `.txt` or `.html`). This must be specified if `body` is. If this is
  not specified but `filePath` is, then the type is inferred from the extension
  on the path. If neither `body` nor `filePath` is specified (that is, for an
  empty body), then this must not be specified either. In the MIME type form,
  an explicit `charset` is honored (e.g. `text/plain; charset=iso-8859-1`), but
  if not specified then `utf-8` is assumed for text types.
* `cacheControl` &mdash; `cache-control` header definition. If present and not
  `false`, every cacheable response comes with the specified header.
* `etag` &mdash; ETag-generating options. If present and not `false`, the
  response comes with an `ETag` header. See "ETag Configuration" below for
  details.
* `filePath` &mdash; Optional absolute filesystem path to the file to respond
  with.
* `statusCode` &mdash; Optional fixed status code to report. If present and not
  `null`, this is the numeric status code that will be used for all responses.
  Setting this also prevents range requests and not-modified responses from
  being generated.

It is valid to specify neither `body` nor `filePath`; this indicates that the
application should only ever produce no-content (status `204`) responses. It is
_not_ valid to specify _both_ `body` and `filePath`.

**Note:** Passing `body` as an empty string or `Buffer` is treated as
zero-length but contentful, e.g. a regular successful response will be status
`200` with `Content-Length: 0`. Likewise, this is how an empty file pointed at
by a `filePath` behaves.

```js
import { SimpleResponse } from '@lactoserv/webapp-builtins';

const applications = [
  {
    name:                'literal',
    class:               SimpleResponse,
    contentType:         'text/plain',
    body:                'Hello!\n',
    cacheControl:        { public: true, maxAge: '1_day' },
    maxPathDepth:        0,
    redirectDirectories: true,
  },
  {
    name:         'fromFile',
    class:        'SimpleResponse',
    filePath:     '/etc/site/notFoundMessage.txt',
    cacheControl: 'immutable; max-age=1000',
    statusCode:   404
  },
  {
    name:  'empty',
    class: 'SimpleResponse'
  }
];
```

There are a few notable things which _aren't_ configurable for this application.
These may be configurable in a future version, if there is sufficient and
reasonable demand:

* Content types:
  * The mapping from extensions to MIME types is not configurable.
* Caching:
  * The `Last-Modified` response header is always sent when given a `filePath`,
    and not sent when given a `body`.
  * Unless `statusCode` is set in the configuration, conditional request headers
    are honored.
* Ranges:
  * Unless `statusCode` is set in the configuration:
    * The `Accept-Ranges` response header is always sent.
    * Range request headers are honored, including conditional range requests.

## `StaticFiles`

An application which serves static files from a local directory. This
application accepts the following configuration bindings:

* `acceptMethods` &mdash; Common configuration option, but in this case the
  default is `['get', 'head']`.
* `etag` &mdash; ETag-generating options. If present and not `false`, the
  response comes with an `ETag` header. See "ETag Configuration" below for
  details.
* `cacheControl` &mdash; `cache-control` header definition. If present and not
  `false`, every cacheable response comes with the specified header.
* `notFoundPath` &mdash; Optional filesystem path to the file to serve when a
  file/path is not found. The indicated file will get sent back along with a
  `404` ("Not Found") status code.
* `siteDirectory` &mdash; Filesystem directory root for the files to serve.

```js
import { StaticFiles } from '@lactoserv/webapp-builtins';

const applications = [
  {
    name:          'mySite',
    class:         StaticFiles,
    siteDirectory: '/path/to/site',
    notFoundPath:  '/path/to/404.html'
  }
];
```

There are a few notable things which _aren't_ configurable for this application.
These may be configurable in a future version, if there is sufficient and
reasonable demand:

* Content types:
  * The `Content-Type` headers are based on the file extensions of the files
    being served.
  * The mapping from extensions to MIME types is not configurable.
  * Textual file types are always reported to have `charset=utf-8`.
* Caching:
  * The `Last-Modified` response header is always sent.
  * Conditional request headers are honored.
* Ranges:
  * The `Accept-Ranges` response header is always sent.
  * Range request headers are honored, including conditional range requests.
* Directory responses:
  * "Naked" directory paths (i.e. ones that do not end with a slash) are
    redirected to the same path with a final slash appended.
  * Directory paths are responded to with the contents of a file called
    `index.html` in that directory, if it exists. The index file name is not
    configurable.
* These "odd" URL paths all cause not-found responses:
  * Ones with a `..` that would "back out" of the site directory.
  * Ones with an _encoded_ slash in them, that is to say literally `%2F`. (It is
    more trouble than it's worth to try to figure out a way for this to be
    implementable in a non-wacky unambiguous way.)
  * Ones with an internal empty path component, e.g. with `//` somewhere in
    them. Many filesystems will "collapse" multiple slashes away, but we choose
    to err on the side of being conservative and report this as an error rather
    than wade blithely into DWIM territory.
  * End with an empty path component (that is, end with a slash), when the path
    does not in fact correspond to a directory.
* The bodies of error and other non-content responses, other than `404`s, are
  not configurable.
* No files under the `siteDirectory` are filtered out and treated as not found.
  Notably, dotfiles &mdsah; that is, paths where the final component starts with
  a dot (`.`) &mdash; are served when corresponding files are found.

- - - - - - - - - -
```
Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
SPDX-License-Identifier: Apache-2.0
```
