// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseDirDirective } from '#p/BaseDirDirective';
import { ExpanderWorkspace } from '#p/ExpanderWorkspace';
import { JsonDirective } from '#x/JsonDirective';

import { MustBe } from '@this/typey';

import * as fs from 'node:fs/promises';
import * as Path from 'node:path';

// File type constants.
/** @type {string} */ const TYPE_JSON     = 'json';
/** @type {string} */ const TYPE_RAW_JSON = 'rawJson';
/** @type {string} */ const TYPE_TEXT     = 'text';

/**
 * Directive `$textFile`. See the package README for more details.
 */
export class TextFileDirective extends JsonDirective {
  /** @type {ExpanderWorkspace} Associated workspace. */
  #workspace;

  /** @type {string} The (possibly-relative) file path. */
  #filePath;

  /** @type {string} The file type. */
  #fileType;

  /** @override */
  constructor(workspace, path, dirArg, dirValue) {
    MustBe.string(dirArg.$arg);
    super(workspace, path, dirArg, dirValue);

    const type = dirArg.type ?? 'text';
    if (!TextFileDirective.#FILE_TYPES.has(type)) {
      throw new Error(`Unrecognized file type: ${type}`);
    }

    this.#workspace = workspace;
    this.#filePath  = dirArg.$arg;
    this.#fileType  = type;
  }

  /** @override */
  process() {
    if (!this.#filePath.match(/^[/]/)) {
      // It's a relative path, so we need to get the base directory.
      const baseDir = BaseDirDirective.getDir(this.#workspace);

      if (baseDir === null) {
        return { action: 'again' };
      }

      this.#filePath = Path.resolve(baseDir, this.#filePath);
    }

    return {
      action: 'resolve',
      value:  this.#readAndProcess(),
      await:  true
    };
  }

  /**
   * Main implementation of file reading and (sometimes) parsing.
   */
  async #readAndProcess() {
    const textPromise = fs.readFile(this.#filePath, 'utf-8');

    switch (this.#fileType) {
      case TYPE_JSON: {
        throw new Error(`Can't yet handle type ${this.#fileType}.`);
      }
      case TYPE_RAW_JSON: {
        return JSON.parse(await textPromise);
      }
      case TYPE_TEXT: {
        return textPromise;
      }
      default: {
        throw new Error(`Unrecognized file type: ${this.#fileType}`);
      }
    }
  }


  //
  // Static members
  //

  static #FILE_TYPES = new Set([TYPE_JSON, TYPE_RAW_JSON, TYPE_TEXT]);

  /** @override */
  static get ALLOW_EXTRA_BINDINGS() {
    return false;
  }

  /** @override */
  static get NAME() {
    return '$textFile';
  }

  /** @override */
  static get NAMED_ARGS() {
    return ['type'];
  }

  /** @override */
  static get REQUIRES() {
    return ['$baseDir'];
  }
}
