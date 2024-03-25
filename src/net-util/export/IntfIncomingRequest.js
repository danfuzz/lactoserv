// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IncomingMessage } from 'node:http';

import { TreePathKey } from '@this/collections';
import { IntfLogger } from '@this/loggy-intf';
import { Methods } from '@this/typey';

import { Cookies } from '#x/Cookies';
import { HostInfo } from '#x/HostInfo';
import { HttpHeaders } from '#x/HttpHeaders';
import { RequestContext } from '#x/RequestContext';


/**
 * Representation of a received and in-progress HTTP(ish) request.
 *
 * **Note:** This interface does not define its API to have any understanding of
 * running a system behind a reverse proxy. For example, `Forwarded` and related
 * headers have no special meaning to this interface.
 *
 * @interface
 */
export class IntfIncomingRequest {
  /**
   * @returns {RequestContext} Information about the context in which this
   * instance was received.
   */
  get context() {
    throw Methods.abstract();
  }

  /**
   * @returns {Cookies} Cookies that have been parsed from the request, if any.
   * This is an empty instance if there were no cookies (or at least no
   * syntactically correct cookies). Whether or not empty, the instance is
   * always frozen.
   */
  get cookies() {
    throw Methods.abstract();
  }

  /** @returns {HttpHeaders} Incoming headers of the request. */
  get headers() {
    throw Methods.abstract();
  }

  /**
   * @returns {HostInfo} Info about the host (a/k/a the "authority") being asked
   * to respond to this request. This is the value of the synthetic `:authority`
   * header of an HTTP-2 request if available, or the regular `Host` header of
   * an HTTP-1 request. If there is no authority information present in the
   * request, it is treated as if it were specified as just `localhost`.
   *
   * The `port` of the returned object is as follows:
   *
   * * If the `:authority` or `Host` header has a port, use that.
   * * If the connection has a "declared listening port," use that.
   * * If the connection has a known listening port, use that.
   * * Otherwise, use `0` for the port.
   */
  get host() {
    throw Methods.abstract();
  }

  /**
   * @returns {?string} The unique-ish request ID, or `null` if there is none
   * (which will happen if there is no associated logger).
   */
  get id() {
    throw Methods.abstract();
  }

  /**
   * @returns {?IntfLogger} The logger to use with this instance, or `null` if
   * the instance is not doing any logging.
   */
  get logger() {
    throw Methods.abstract();
  }

  /**
   * @returns {string} The HTTP(ish) request method, downcased, e.g. commonly
   * one of `'get'`, `'head'`, or `'post'`.
   */
  get method() {
    throw Methods.abstract();
  }

  /**
   * @returns {{ address: string, port: number }} The IP address and port of
   * the origin (remote side) of the request.
   */
  get origin() {
    throw Methods.abstract();
  }

  /**
   * @returns {?TreePathKey} Parsed path key form of {@link #pathnameString}, or
   * `null` if this instance doesn't represent a usual `origin` request.
   *
   * **Note:** If the original incoming pathname was just `'/'` (e.g., it was
   * from an HTTP request of literally `GET /`), then the value here is a
   * single-element key with empty value, that is `['']`, and _not_ an empty
   * key. This preserves the invariant that the keys for all directory-like
   * requests end with an empty path element.
   *
   * **Note:** The name of this field matches the equivalent field of the
   * standard `URL` class.
   */
  get pathname() {
    throw Methods.abstract();
  }

  /**
   * @returns {?string} The path portion of {@link #targetString}, as a string,
   * or `null` if this instance doesn't represent a usual `origin` request (that
   * is, the kind that includes a path). This starts with a slash (`/`) and
   * omits the search a/k/a query (`?...`), if any. This also includes
   * "resolving" away any `.` or `..` components.
   */
  get pathnameString() {
    throw Methods.abstract();
  }

  /**
   * @returns {string} The name of the protocol which this instance is using.
   * This is generally a string starting with `http-` and ending with the
   * dotted version. This corresponds to the (unencrypted) protocol being used
   * over the (possibly encrypted) transport, and has nothing to do _per se_
   * with the port number which the remote side of this request connected to in
   * order to send the request. That is, `https*` won't be the value of this
   * property.
   */
  get protocolName() {
    throw Methods.abstract();
  }

  /**
   * @returns {string} The search a/k/a query portion of {@link #targetString},
   * as an unparsed string, or `''` (the empty string) if there is no search
   * string. The result includes anything at or after the first question mark
   * (`?`) in the URL. In the case of a "degenerate" search of _just_ a question
   * mark with nothing after, this returns `''`.
   *
   * **Note:** The name of this field matches the equivalent field of the
   * standard `URL` class.
   */
  get searchString() {
    throw Methods.abstract();
  }

  /**
   * @returns {string} The unparsed target that was passed in to the original
   * HTTP(ish) request. In the common case of the target being a path to a
   * resource, colloquially speaking, this is the suffix of the URL-per-se
   * starting at the first slash (`/`) after the host identifier. That said,
   * there are other non-path forms for a target. See
   * <https://www.rfc-editor.org/rfc/rfc7230#section-5.3> for the excruciating
   * details.
   *
   * For example, for the requested URL
   * `https://example.com:123/foo/bar?baz=10`, this would be `/foo/bar?baz=10`.
   * This property name corresponds to the standard Node field
   * {@link IncomingMessage#url}, even though it's not actually a URL per se. We
   * chose to diverge from Node for the sake of clarity.
   */
  get targetString() {
    throw Methods.abstract();
  }

  /**
   * @returns {string} A reasonably-suggestive but possibly incomplete
   * representation of the incoming request including both the host and target,
   * in the form of a protocol-less URL in most cases (and something vaguely
   * URL-like when the target isn't the usual `origin` type).
   *
   * This value is meant for logging, and specifically _not_ for any routing or
   * other more meaningful computation (hence the name).
   */
  get urlForLogging() {
    throw Methods.abstract();
  }

  /**
   * Gets a request header, by name.
   *
   * @param {string} name The header name.
   * @returns {?string|Array<string>} The corresponding value, or `null` if
   *   there was no such header.
   */
  getHeaderOrNull(name) {
    throw Methods.abstract(name);
  }

  /**
   * Gets all reasonably-logged info about the request that was made.
   *
   * **Note:** The `headers` in the result omits anything that is redundant
   * with respect to other parts of the return value. (E.g., the `cookie` header
   * is omitted if it was able to be parsed.)
   *
   * @returns {object} Loggable information about the request. The result is
   *   always frozen.
   */
  getLoggableRequestInfo() {
    throw Methods.abstract();
  }
}
