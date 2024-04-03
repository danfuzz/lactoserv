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

/**
 * Sorts the entries of a plain object by key, returning a sorted version.
 *
 * @param {object} orig Object to sort.
 * @returns {object} Sorted version.
 */
function sortObject(orig) {
  const result = {};

  for (const key of Object.keys(orig).sort()) {
    result[key] = orig[key];
  }

  return result;
}


//
// Main script
//

const errors = [];

// Collect all of the modules referenced by this package, transitively including
// all referenced local modules. This uses a work queue arrangement where we
// start with the main subproject as the sole element of the to-be-processed
// queue.

/** The names of all as-yet unprocessed local modules. */
const unprocessed = new Set([`@this/${mainModule}`]);

/** The names of all already-processed local modules. */
const processed = new Set();

/** The graph of local module dependencies, as a list of edges. */
let graph = [];

/** Map from external dependency names to sets of all encountered versions. */
const extDeps = new Map();

/** The names of all local modules encountered as dependencies. */
const localDeps = new Set();

/** The path to each local module directory. */
const localDirs = new Map();

while (unprocessed.size > 0) {
  const oneDep = setPop(unprocessed);

  processed.add(oneDep);
  localDeps.add(oneDep);

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

  localDirs.set(oneDep, moduleDir);

  for (const [key, value] of Object.entries(packageObj.dependencies ?? {})) {
    if (key.startsWith('@this/')) {
      if (!processed.has(key)) {
        unprocessed.add(key);
      }
      graph.push({ from: oneDep, to: key });
    } else {
      let extSet = extDeps.get(key);
      if (!extSet) {
        extSet = new Set();
        extDeps.set(key, extSet);
      }
      extSet.add(value);
    }
  }
}

// Build up the final result.

const result = {
  main:      `@this/${mainModule}`,
  localDeps: [...localDeps].sort(),
  localDirs: sortObject(Object.fromEntries(localDirs.entries())),
  extDeps:   sortObject(Object.fromEntries(extDeps.entries()))
};

// `extDeps` has sets for values. Reduce them to single elements, and report an
// error for any item with multiple values.

for (const [key, value] of Object.entries(result.extDeps)) {
  if (value.size !== 1) {
    errors.push(`Conflicting versions of external dependency \`${key}\`:`);
    for (const v of value) {
      errors.push(`  ${v}`);
    }
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

const fromNodes = new Set(graph.map(({ from }) => from));

for (;;) {
  const toNodes    = new Set(graph.map(({ to }) => to));
  let   anyRemoved = false;

  for (const f of fromNodes) {
    if (!toNodes.has(f)) {
      graph = graph.filter(({ from, to }) => (from !== f));
      fromNodes.delete(f);
      anyRemoved = true;
    }
  }

  if (anyRemoved) {
    continue;
  }

  // Check for self-dependency. If found, report the error, remove the nodes,
  // and keep checking.
  for (const { from, to } of graph) {
    if (from === to) {
      errors.push(`Local module self-dependency: ${from}`);
      graph = graph.filter(({ from: f }) => (from !== f));
      fromNodes.delete(from);
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
