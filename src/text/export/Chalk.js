// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { default as chalk, Chalk as OrigChalk } from 'chalk';


/**
 * Exposes instances of `Chalk`.
 *
 * What's going on: By default `Chalk` tries to be smart about disabling its
 * default instance based on the properties of `stdout`, but in this project, we
 * typically do our own TTY detection and ultimately have reason to use ANSI
 * styling even when `stdout` isn't a (color) TTY.
 */
export class Chalk {
  /** @type {Chalk} Always-enabled instance. */
  static ON = new OrigChalk({ level: 3 });

  /** @type {Chalk} Instance which is enabled appropriately for `stdout`. */
  static STDOUT = chalk;
}
