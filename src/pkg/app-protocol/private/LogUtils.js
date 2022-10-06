// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as http2 from 'node:http2';
import * as process from 'node:process';

import * as express from 'express';

import { LogRecord } from '@this/loggy';


/**
 * Utilities for logging.
 */
export class LogUtils {
  /**
   * Makes a human-friendly network address/port string.
   *
   * @param {string} address The address.
   * @param {number} port The port.
   * @returns {string} The friendly form.
   */
  static addressPortString(address, port) {
    if (/:/.test(address)) {
      // IPv6 form.
      return `[${address}]:${port}`;
    } else {
      // IPv4 form.
      return `${address}:${port}`;
    }
  }

  /**
   * Makes a human-friendly content length string.
   *
   * @param {?number} contentLength The content length.
   * @returns {string} The friendly form.
   */
  static contentLengthString(contentLength) {
    if (contentLength === null) {
      return '<unknown-length>';
    } else if (contentLength < 1024) {
      return `${contentLength}B`;
    } else if (contentLength < (1024 * 1024)) {
      const kilobytes = (contentLength / 1024).toFixed(2);
      return `${kilobytes}kB`;
    } else {
      const megabytes = (contentLength / 1024 / 1024).toFixed(2);
      return `${megabytes}MB`;
    }
  }

  /**
   * Makes a human-friendly elapsed time string.
   *
   * @param {number} elapsedMsec The elapsed time in msec.
   * @returns {string} The friendly form.
   */
  static elapsedTimeString(elapsedMsec) {
    if (elapsedMsec < 10) {
      const msec = elapsedMsec.toFixed(2);
      return `${msec}msec`;
    } else if (elapsedMsec < 1000) {
      const msec = elapsedMsec.toFixed(0);
      return `${msec}msec`;
    } else {
      const sec = (elapsedMsec / 1000).toFixed(1);
      return `${sec}sec`;
    }
  }
}
