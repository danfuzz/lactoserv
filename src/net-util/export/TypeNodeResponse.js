// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ServerResponse } from 'node:http';
import { Http2ServerResponse } from 'node:http2';


/**
 * Type which covers all the recognized forms of a response object that come
 * from the low-level Node libraries.
 *
 * @typedef {ServerResponse|Http2ServerResponse} TypeNodeResponse
 */
export const TypeNodeResponse = Symbol('TypeNodeResponse');
