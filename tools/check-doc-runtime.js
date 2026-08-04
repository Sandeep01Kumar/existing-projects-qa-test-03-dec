#!/usr/bin/env node
'use strict';

/**
 * @file Preflight guard that refuses to run a documentation command on a Node.js
 * runtime older than the declared development-tooling floor.
 *
 * @module tools/check-doc-runtime
 *
 * @description
 * This project deliberately carries **two different runtime floors**, because it
 * has two different audiences:
 *
 * 1. `engines.node` in `package.json` is the **application** floor. `server.js`
 *    imports nothing but the core `http` module, so the service itself runs on
 *    every currently supported Node.js line. That value is what the README and
 *    `docs/getting-started/installation.md` quote as the prerequisite for running
 *    the service.
 * 2. `devEngines.runtime` in `package.json` is the **documentation toolchain**
 *    floor. The pinned toolchain resolves a transitive closure whose own
 *    `engines` declarations sit far above the application floor, so a reader on a
 *    runtime that satisfies `engines` but not `devEngines` can install with
 *    warnings and then run documentation commands that fail in obscure ways.
 *
 * npm evaluates `devEngines` both at install time and on `npm run`, and the
 * manifest declares `onFail: "warn"` there on purpose: `error` would make npm
 * abort `npm start` and `npm test` on every runtime below the *documentation*
 * floor, even though the *application* floor in `engines.node` promises those
 * commands work there. A warning is the correct npm-level behaviour, because the
 * service genuinely does run on that runtime.
 *
 * A warning is **not** correct for a `docs:*` command, which cannot work at all
 * below the floor. This module is therefore the run-time half of the gate and it
 * fails closed: callers pass {@link GATE_POLICY} so an unsupported runtime stops
 * the command immediately with an actionable message instead of surfacing as a
 * syntax error from deep inside a dependency. The manifest's `onFail` still
 * governs what npm itself does, and remains the default when no policy is
 * supplied.
 *
 * Two design constraints shaped the implementation:
 *
 * - **No dependencies.** The guard has to work when `npm install` has failed or
 *   has never been run, which is precisely the situation an unsupported runtime
 *   produces. It therefore uses only the Node.js core library and implements the
 *   small amount of range comparison it needs rather than importing `semver`.
 * - **A single source of truth.** The required range, the failure policy, and the
 *   toolchain it protects are all read out of `package.json` at runtime. Nothing
 *   about the floor is duplicated here, so editing the manifest is sufficient to
 *   change what this guard enforces.
 *
 * The guard **fails closed**: any condition that leaves it unable to prove the
 * runtime is supported -- a missing manifest, a missing `devEngines.runtime`, an
 * unparseable version, a range expression it cannot evaluate -- is reported as a
 * failure with a non-zero exit code, never waved through.
 *
 * @example
 * // As a command, which is how the docs:* npm scripts invoke it:
 * //   $ node tools/check-doc-runtime.js
 * //   $ npm run docs:preflight
 * //
 * // Exit code 0 when the running runtime satisfies devEngines.runtime,
 * // exit code 1 (with a diagnostic on stderr) when it does not.
 *
 * @example
 * // As a library, which is how tools/check-links.js reuses it:
 * const { enforce } = require('./check-doc-runtime.js');
 * const exitCode = enforce();
 * if (exitCode !== 0) {
 *   process.exit(exitCode);
 * }
 *
 * @see {@link https://docs.npmjs.com/cli/v11/configuring-npm/package-json#devengines|npm devEngines documentation}
 */

const fs = require('fs');
const path = require('path');

/**
 * Absolute path of the manifest that owns both runtime floors.
 *
 * Resolved from this file's own location rather than from `process.cwd()`, so the
 * guard behaves identically whether it is invoked by an npm script (cwd is the
 * package root) or by a developer from a subdirectory.
 *
 * @constant {string}
 */
const MANIFEST_PATH = path.join(__dirname, '..', 'package.json');

/**
 * Exit code returned when the runtime is supported.
 *
 * @constant {number}
 * @default 0
 */
const EXIT_SUPPORTED = 0;

/**
 * Exit code returned when the runtime is unsupported, or when the guard cannot
 * prove that it is supported. Both cases are failures: the guard fails closed.
 *
 * @constant {number}
 * @default 1
 */
const EXIT_UNSUPPORTED = 1;

/**
 * Failure policy applied when `devEngines.runtime.onFail` is absent from the
 * manifest. Mirrors npm's own default so that the install-time gate and this
 * run-time gate cannot disagree about the same declaration.
 *
 * @constant {string}
 * @default 'error'
 */
const DEFAULT_ON_FAIL = 'error';

/**
 * Failure policy the documentation gates apply, regardless of what
 * `devEngines.runtime.onFail` tells npm to do.
 *
 * The two are deliberately allowed to differ. `onFail` is `warn` so that npm
 * does not abort `npm start` or `npm test` on a runtime the application floor
 * supports; a `docs:*` command, by contrast, has no working behaviour below the
 * toolchain floor, so it must stop rather than warn and continue.
 *
 * @constant {string}
 * @default 'error'
 */
const GATE_POLICY = 'error';

/**
 * Reads and parses the package manifest.
 *
 * @param {string} manifestPath Absolute path of the `package.json` to read.
 * @returns {Object} The parsed manifest.
 * @throws {Error} If the file cannot be read or is not valid JSON. The message
 *   names the path, because a guard that fails silently is worse than no guard.
 */
function readManifest(manifestPath) {
  let raw;

  try {
    raw = fs.readFileSync(manifestPath, 'utf8');
  } catch (cause) {
    throw new Error(`unable to read the package manifest at ${manifestPath}: ${cause.message}`);
  }

  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new Error(`the package manifest at ${manifestPath} is not valid JSON: ${cause.message}`);
  }
}

/**
 * Extracts the declared development-tooling runtime requirement.
 *
 * @param {Object} manifest A parsed `package.json`.
 * @returns {{name: string, range: string, onFail: string}} The declared runtime
 *   name, the version range it must satisfy, and the failure policy.
 * @throws {Error} If `devEngines.runtime` is missing or malformed, or declares a
 *   runtime other than Node.js. Absence is treated as an error rather than as
 *   "no floor to check", because the whole point of this guard is that the floor
 *   is declared in exactly one place.
 */
function readRuntimeRequirement(manifest) {
  const runtime = manifest && manifest.devEngines && manifest.devEngines.runtime;

  if (!runtime || typeof runtime !== 'object') {
    throw new Error('the package manifest declares no devEngines.runtime, so the documentation toolchain floor cannot be verified');
  }

  const name = typeof runtime.name === 'string' ? runtime.name : '';
  const range = typeof runtime.version === 'string' ? runtime.version.trim() : '';

  if (name !== 'node') {
    throw new Error(`devEngines.runtime.name is "${name}" but this guard only understands "node"`);
  }

  if (range === '') {
    throw new Error('devEngines.runtime.version is empty, so there is no floor to enforce');
  }

  return {
    name,
    range,
    onFail: typeof runtime.onFail === 'string' ? runtime.onFail : DEFAULT_ON_FAIL
  };
}

/**
 * Parses a semantic version into its numeric components.
 *
 * Accepts an optional leading `v` and discards any prerelease or build metadata,
 * which is what makes `process.versions.node` values such as `23.0.0-nightly`
 * comparable against a plain floor.
 *
 * @param {string} value The version to parse.
 * @returns {number[]} A `[major, minor, patch]` tuple.
 * @throws {Error} If the value is not a recognisable `major.minor.patch` version.
 */
function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(value).trim());

  if (!match) {
    throw new Error(`"${value}" is not a parseable major.minor.patch version`);
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Compares two version tuples component by component.
 *
 * @param {number[]} left A `[major, minor, patch]` tuple.
 * @param {number[]} right A `[major, minor, patch]` tuple.
 * @returns {number} `-1` when `left` is lower, `1` when it is higher, `0` when
 *   the two are equal.
 */
function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] < right[index] ? -1 : 1;
    }
  }

  return 0;
}

/**
 * Expands a single range token into one or more primitive comparators.
 *
 * The supported vocabulary is deliberately narrow but complete for the forms a
 * runtime floor is written in: `>=`, `>`, `<=`, `<`, `=`, a bare version, `^`,
 * and `~`. Anything else throws, so an unrecognised range can never be silently
 * treated as satisfied.
 *
 * @param {string} token One whitespace-delimited piece of a range expression.
 * @returns {Array<{operator: string, version: number[]}>} Primitive comparators
 *   that must all hold for the token to be satisfied.
 * @throws {Error} If the token uses an operator this guard does not implement.
 */
function expandComparator(token) {
  const match = /^(>=|<=|>|<|=|\^|~)?\s*(.+)$/.exec(token);

  if (!match) {
    throw new Error(`"${token}" is not a comparator this guard can evaluate`);
  }

  const operator = match[1] || '=';
  const version = parseVersion(match[2]);
  const [major, minor] = version;

  // `^` and `~` are shorthand for a bounded window, so they expand into a lower
  // bound plus an exclusive upper bound. `^0.y.z` is treated the way the semver
  // specification defines it: a minor bump is a breaking change below 1.0.0.
  if (operator === '^') {
    const upper = major === 0 ? [0, minor + 1, 0] : [major + 1, 0, 0];
    return [{ operator: '>=', version }, { operator: '<', version: upper }];
  }

  if (operator === '~') {
    return [{ operator: '>=', version }, { operator: '<', version: [major, minor + 1, 0] }];
  }

  return [{ operator, version }];
}

/**
 * Evaluates one primitive comparator against a version.
 *
 * @param {number[]} version The version under test.
 * @param {{operator: string, version: number[]}} comparator The comparator.
 * @returns {boolean} `true` when the comparator holds.
 * @throws {Error} If the comparator carries an operator this guard cannot apply.
 */
function satisfiesComparator(version, comparator) {
  const order = compareVersions(version, comparator.version);

  switch (comparator.operator) {
    case '>=':
      return order >= 0;
    case '>':
      return order > 0;
    case '<=':
      return order <= 0;
    case '<':
      return order < 0;
    case '=':
      return order === 0;
    default:
      throw new Error(`"${comparator.operator}" is not an operator this guard can apply`);
  }
}

/**
 * Tests a version against a range expression.
 *
 * Supports comparator sets joined by `||` (any set may satisfy the range) whose
 * members are whitespace-separated comparators (every comparator in a set must
 * hold) -- the two forms an `engines`-style declaration realistically uses.
 *
 * @param {string} version The version under test, for example `process.versions.node`.
 * @param {string} range The declared range, for example `>=22.12.0`.
 * @returns {boolean} `true` when the version satisfies the range.
 * @throws {Error} If either argument cannot be evaluated.
 */
function satisfiesRange(version, range) {
  const candidate = parseVersion(version);

  const sets = String(range)
    .split('||')
    .map((set) => set.trim())
    .filter((set) => set !== '');

  if (sets.length === 0) {
    throw new Error(`"${range}" contains no comparator to evaluate`);
  }

  return sets.some((set) => set
    .split(/\s+/)
    .flatMap((token) => expandComparator(token))
    .every((comparator) => satisfiesComparator(candidate, comparator)));
}

/**
 * Evaluates the running runtime against the manifest's declared tooling floor.
 *
 * @param {Object} [options] Evaluation options.
 * @param {string} [options.manifestPath] Manifest to read the requirement from.
 *   Defaults to this package's own `package.json`.
 * @param {string} [options.runtimeVersion] Version to test. Defaults to the
 *   running Node.js version; overridable so the guard's own behaviour can be
 *   verified against a runtime other than the one executing it.
 * @returns {{satisfied: boolean, runtimeVersion: string, range: string, onFail: string,
 *   applicationRange: string, toolchain: string[], failure: (string|null)}}
 *   The outcome, plus the context needed to explain it.
 */
function evaluate(options) {
  const settings = options || {};
  const manifestPath = settings.manifestPath || MANIFEST_PATH;
  const runtimeVersion = settings.runtimeVersion || process.versions.node;

  const result = {
    satisfied: false,
    runtimeVersion,
    range: '',
    onFail: DEFAULT_ON_FAIL,
    applicationRange: '',
    toolchain: [],
    failure: null
  };

  try {
    const manifest = readManifest(manifestPath);
    const requirement = readRuntimeRequirement(manifest);

    result.range = requirement.range;
    result.onFail = requirement.onFail;
    result.applicationRange = (manifest.engines && typeof manifest.engines.node === 'string')
      ? manifest.engines.node
      : '';
    result.toolchain = Object.entries(manifest.devDependencies || {})
      .map(([name, version]) => `${name} ${version}`)
      .sort();
    result.satisfied = satisfiesRange(runtimeVersion, requirement.range);
  } catch (cause) {
    // Fail closed: an unevaluable declaration is a failure, not a pass.
    result.satisfied = false;
    result.failure = cause.message;
  }

  return result;
}

/**
 * Renders the one-line confirmation printed when the runtime is supported.
 *
 * @param {Object} result A result object produced by {@link evaluate}.
 * @returns {string} The message to print.
 */
function formatSuccess(result) {
  return `documentation toolchain runtime check: node v${result.runtimeVersion} satisfies devEngines.runtime "${result.range}"`;
}

/**
 * Renders the diagnostic printed when the runtime is unsupported, or when the
 * requirement could not be evaluated.
 *
 * The message names what is running, what is required, where the requirement is
 * declared, which packages impose it, and what to do next -- everything a reader
 * needs without opening another file.
 *
 * @param {Object} result A result object produced by {@link evaluate}.
 * @returns {string} The multi-line message to print.
 */
function formatFailure(result) {
  const lines = [
    'Documentation toolchain runtime check FAILED.',
    '',
    `  running   : node v${result.runtimeVersion}`,
    `  required  : node ${result.range || '(not declared)'}   [package.json devEngines.runtime, onFail: ${result.onFail}]`
  ];

  if (result.failure) {
    lines.push(`  problem   : ${result.failure}`);
  }

  if (result.toolchain.length > 0) {
    lines.push(`  toolchain : ${result.toolchain.join(', ')}`);
    lines.push('              the transitive closure of these pinned packages declares the floor above,');
    lines.push('              so installing or running them on an older runtime is unsupported.');
  }

  if (result.applicationRange) {
    lines.push('');
    lines.push(`  The service itself still supports the wider engines range "${result.applicationRange}":`);
    lines.push('  this floor applies only to installing the documentation devDependencies and to');
    lines.push('  the docs:* commands, never to running server.js.');
  }

  lines.push('');
  lines.push(`  Switch to a Node.js release satisfying "${result.range || 'the declared range'}" and re-run the command.`);

  return lines.join('\n');
}

/**
 * Evaluates the runtime, reports the outcome, and returns the exit code the
 * caller should exit with.
 *
 * `error` fails the command, `warn` reports and continues, `ignore` stays silent,
 * and anything else is treated as `error` because an unrecognised policy must not
 * weaken the gate.
 *
 * Which policy applies is the caller's decision. Passing none honours the
 * manifest's `devEngines.runtime.onFail`, so this gate agrees with npm about that
 * declaration. Documentation commands instead pass {@link GATE_POLICY} because
 * they cannot run below the floor at all, while the manifest keeps `onFail` at
 * `warn` so npm does not abort `npm start`/`npm test` on a runtime the
 * application floor supports.
 *
 * @param {Object} [options] Options forwarded to {@link evaluate}, plus:
 * @param {boolean} [options.quiet=false] Suppress the success confirmation.
 *   Failures are always reported.
 * @param {string} [options.policy] Failure policy to apply instead of the
 *   manifest's `onFail`. Documentation gates pass {@link GATE_POLICY}.
 * @returns {number} `0` when the command may proceed, `1` when it must not.
 */
function enforce(options) {
  const settings = options || {};
  const result = evaluate(settings);

  if (result.satisfied) {
    if (!settings.quiet) {
      process.stdout.write(`${formatSuccess(result)}\n`);
    }

    return EXIT_SUPPORTED;
  }

  const policy = typeof settings.policy === 'string' ? settings.policy : result.onFail;
  const message = formatFailure(result);

  if (policy === 'ignore') {
    return EXIT_SUPPORTED;
  }

  if (policy === 'warn') {
    process.stderr.write(`WARNING: ${message}\n`);
    return EXIT_SUPPORTED;
  }

  process.stderr.write(`${message}\n`);

  return EXIT_UNSUPPORTED;
}

module.exports = {
  MANIFEST_PATH,
  EXIT_SUPPORTED,
  EXIT_UNSUPPORTED,
  DEFAULT_ON_FAIL,
  GATE_POLICY,
  readManifest,
  readRuntimeRequirement,
  parseVersion,
  compareVersions,
  expandComparator,
  satisfiesComparator,
  satisfiesRange,
  evaluate,
  formatSuccess,
  formatFailure,
  enforce
};

// Command entry point. Kept behind `require.main` so that requiring this module
// from tools/check-links.js performs the check on that script's terms instead of
// exiting the process during import.
if (require.main === module) {
  process.exitCode = enforce({
    quiet: process.argv.includes('--quiet'),
    policy: GATE_POLICY
  });
}
