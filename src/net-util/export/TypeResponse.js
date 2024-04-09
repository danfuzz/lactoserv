// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { OutgoingResponse } from '#x/OutgoingResponse';


/**
 * Type definition for the sorts of values allowed when responding to
 * network requests, when using the classes in this module.
 *
 * * {@link OutgoingResponse} -- A complete response.
 * * `null` -- Indicator that the request was not handled (which is different
 *   than being handled with a result of "not found").
 *
 * @typedef {OutgoingResponse|null} TypeResponse
 */
export const TypeResponse = Symbol('TypeResponse');
