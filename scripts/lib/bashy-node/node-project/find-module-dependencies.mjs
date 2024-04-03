// Copyright 2022-2024 the Bashy-lib Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs';

//
// Argument parsing
//

const { mainModule, modulesDirs } = JSON.parse(process.argv[2]);


//
// Helper functions
//

/**
 * Indicates whether or not the path corresponds to a regular file which is
 * readable.
 *
 * @param {string} path The path to check.
 * @returns {boolean} `true` iff the `path` is a readable file.
 */
function canRead(path) {
  try {
    fs.accessSync(path, fs.constants.R_OK);
    const stats = fs.statSync(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * "Pops" an arbitrary item from a `Set`.
 *
 * @param {Set} set The set to pop from.
 * @returns {*} The popped item.
 */
function setPop(set) {
  for (const item of set) {
    set.delete(item);
    return item;
  }

  throw new Error('Empty `Set`.');
}


//
// Main script
//

const errors = [];

// Collect all of the modules referenced by this package, transitively including
// all referenced local modules. This uses a work queue arrangement where we
// start with the main subproject as the sole element of the to-be-processed
// queue.

const state = {
  unprocessed: new Set([`@this/${mainModule}`]),
  graph:       [],
  localDeps:   new Set(),
  localDirs:   new Map(),
  extDeps:     new Map(),
  processed:   new Set(),
  main:        mainModule
};

while (state.unprocessed.size > 0) {
  const oneDep = setPop(state.unprocessed);

  state.processed.add(oneDep);
  state.localDeps.add(oneDep);

  // Trim `@this/` off of `oneDep`.
  const oneDepName = oneDep.match(/(?<=[/])[^/]+$/)?.[0];

  if (!oneDepName) {
    errors.push(`Could not parse module name: ${oneDep}`);
    continue;
  }

  let moduleDir  = null;
  let packageObj = null;
  for (const dir of modulesDirs) {
    const fullDir = `${dir}/${oneDepName}`;
    const pkgFile = `${fullDir}/package.json`;

    if (canRead(pkgFile)) {
      moduleDir = fullDir;
      packageObj = JSON.parse(fs.readFileSync(pkgFile));
      break;
    }
  }

  if (!moduleDir) {
    errors.push(`Could not find module: ${oneDep}`);
    continue;
  }

  state.localDirs.set(oneDep, moduleDir);

  for (const [key, value] of Object.entries(packageObj.dependencies ?? {})) {
    if (key.startsWith('@this/')) {
      if (!state.processed.has(key)) {
        state.unprocessed.add(key);
      }
      state.graph.push({ from: oneDep, to: key });
    } else {
      let extSet = state.extDeps.get(key);
      if (!extSet) {
        extSet = new Set();
        state.extDeps.set(key, extSet);
      }
      extSet.add(value);
    }
  }
}

// Build up the final result.

const result = {
  main:      mainModule,
  localDeps: [...state.localDeps],
  localDirs: Object.fromEntries(state.localDirs.entries()),
  extDeps:   Object.fromEntries(state.extDeps.entries())
};

// `extDeps` has sets for values. Reduce them to single elements, and report an
// error for any item with multiple values.

for (const [key, value] of Object.entries(result.extDeps)) {
  if (value.size !== 1) {
    const versions = [...value].join(', ');
    errors.push(`Conflicting versions of external dependency \`${key}\`: ${versions}`);
  } else {
    result.extDeps[key] = setPop(value);
  }
}

// Verify that the local module dependency graph has no cycles. If there's at
// least one cycle, list all the modules involved with cycles.
//
// What's going on: We start with the full directed graph, and iteratively
// remove all edges for nodes that only appear on the `from` side (because de
// facto they are not involved in a cycle). Once no more edges can be removed,
// any remaining ones are involved in cycles.

let   graph     = state.graph;
const fromNodes = new Set(graph.map(({ from }) => from));

for (;;) {
  const toNodes    = new Set(graph.map(({ to }) => to));
  let   anyRemoved = false;

  for (const f of fromNodes) {
    if (!toNodes.has(f)) {
      graph = graph.filter(({ from, to }) => (from === f));
      fromNodes.delete(f);
      anyRemoved = true;
    }
  }

  if (!anyRemoved) {
    break;
  }
}

if (graph.length !== 0) {
  errors.push('Local module dependency cycle(s) detected.');
  errors.push('Modules involved:');
  for (const f of fromNodes) {
    errors.push(`  ${f}`);
  }
}

// Either report errors or return the final result.

if (errors.length !== 0) {
  for (const error of errors) {
    process.stderr.write(`${error}\n`);
  }
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
