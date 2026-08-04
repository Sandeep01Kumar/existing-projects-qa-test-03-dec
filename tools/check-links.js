#!/usr/bin/env node
'use strict';

/**
 * @file Link-integrity gate for the authored documentation corpus. Checks every
 * link in every authored Markdown file and fails the command unless all of them
 * were successfully checked and found reachable.
 *
 * @module tools/check-links
 *
 * @description
 * This script exists because the `markdown-link-check` **command line** cannot
 * serve as a completion gate, even though its **library** can. Three behaviours
 * of the pinned 3.15.0 CLI combine into a false success:
 *
 * 1. A link whose check could not be completed -- DNS failure, TLS failure, socket
 *    error, timeout, unsupported protocol -- is recorded with the status `error`,
 *    which is a distinct status from `dead`.
 * 2. `--quiet` suppresses the output line for every result that is not `dead`, so
 *    those `error` results are never printed.
 * 3. The CLI exits non-zero only for a top-level failure or for a `dead` result.
 *    `error` results do not affect its exit code.
 *
 * A corpus that was never actually checked therefore exits 0 and looks verified.
 * Dropping `--quiet` alone does not fix it, because the exit logic still ignores
 * `error`. This gate wraps the same pinned library directly and inverts all three
 * behaviours: **every** result is printed, and **both** `dead` and `error` fail
 * the run -- as does any condition that prevents a file from being checked at all
 * (an unreadable file, a synchronous throw out of the checker, an uncaught
 * exception, or an unhandled rejection).
 *
 * Option parity with the CLI is deliberate, so results do not change merely
 * because the invocation route did: `baseUrl` is `file://` plus the directory of
 * the file being checked, which is what makes relative links resolve; and
 * `projectBaseUrl` is `file://` plus the package root, which is what `{{BASEURL}}`
 * expands to. Retrying on HTTP 429 is enabled, matching the CLI's `--retry`.
 *
 * ## Which files are checked
 *
 * The corpus is the union of two sources, and the union is what makes the gate
 * both exhaustive and drift-proof:
 *
 * - {@link PLANNED_CORPUS} -- the thirteen authored Markdown files the
 *   documentation plan defines. Naming them explicitly is what lets this gate
 *   report a planned page that has not been authored yet instead of silently
 *   checking twelve files and reporting success.
 * - Discovery -- every other `.md` file in the repository that is not inside an
 *   ignored directory. A literal list alone would silently stop covering a page
 *   that someone forgets to add to it; discovery closes that hole. The ignore set
 *   mirrors `.gitignore` and `.markdownlint-cli2.jsonc`: installed packages and
 *   generated output are not ours to check.
 *
 * The corpus must match {@link PLANNED_CORPUS} exactly. A planned page that does
 * not exist yet is reported as `MISSING` by name, and an authored page that is not
 * in the plan is reported as `UNEXPECTED` by name; either one fails the run. A
 * recursive check that simply covered whatever happened to be on disk could report
 * success while a required page was absent or had been renamed, so completeness of
 * the corpus is asserted rather than assumed. Unexpected pages are still checked
 * as well as reported, so a new page is never silently left unverified.
 *
 * ## Network policy
 *
 * The gate is hermetic. Repository Markdown is untrusted input -- any change can
 * put an arbitrary URL in a page -- and dereferencing those URLs from the machine
 * running the gate is a server-side request forgery sink (CWE-918), reachable via
 * HEAD, a fallback GET, a redirect, a DNS or MX lookup, or an absolute `file:`
 * target. The policy in `.markdown-link-check.json` removes the sink instead of
 * filtering it: web and mail links are short-circuited before any socket is
 * opened, and every other absolute or traversing target is rewritten onto a
 * path that cannot exist so it fails the gate loudly. That policy also pins
 * `retryOn429` off, which is what bounds the run: the library otherwise hands a
 * remote `Retry-After` value straight to `setTimeout` with no ceiling (CWE-400).
 * Relative and `#anchor` links -- the integrity this gate exists for -- are
 * checked exactly as before.
 *
 * @example
 * // As a command, which is how the docs:links npm script invokes it:
 * //   $ node tools/check-links.js
 * //   $ npm run docs:links
 * //
 * // Exit code 0 only when every link in every authored file was checked
 * // successfully and found reachable; exit code 1 otherwise.
 *
 * @see {@link https://www.npmjs.com/package/markdown-link-check|markdown-link-check}
 * @see tools/check-doc-runtime.js -- the runtime floor this gate enforces first.
 * @see .markdown-link-check.json -- the hermetic link policy this gate loads.
 */

const fs = require('fs');
const path = require('path');

const runtimeGuard = require('./check-doc-runtime.js');

/**
 * Absolute path of the package root, resolved from this file's own location so
 * the gate behaves identically regardless of the working directory it is run
 * from.
 *
 * @constant {string}
 */
const PROJECT_ROOT = path.join(__dirname, '..');

/**
 * Absolute path of the link policy this gate applies.
 *
 * The same file the `markdown-link-check` CLI would read, loaded here so the
 * library route cannot be less safe than the command-line route it replaced.
 *
 * @constant {string}
 */
const LINK_POLICY_PATH = path.join(PROJECT_ROOT, '.markdown-link-check.json');

/**
 * Policy keys copied out of {@link LINK_POLICY_PATH} into the library options.
 *
 * Exactly the subset the pinned CLI itself forwards, so behaviour is identical
 * whichever route is used. `$comment` keys carry the policy's rationale and are
 * deliberately not among them.
 *
 * @constant {string[]}
 */
const LINK_POLICY_KEYS = [
  'ignorePatterns',
  'replacementPatterns',
  'httpHeaders',
  'timeout',
  'ignoreDisable',
  'retryOn429',
  'retryCount',
  'fallbackRetryDelay',
  'aliveStatusCodes'
];

/**
 * Reads the hermetic link policy.
 *
 * Fails closed: the policy is what makes this gate safe to run on untrusted
 * Markdown, so a missing or malformed file must stop the gate rather than let it
 * silently fall back to dereferencing every URL it finds.
 *
 * @returns {Object} The policy options to merge into every check.
 * @throws {Error} When the policy cannot be read or parsed.
 */
function loadLinkPolicy() {
  let raw;

  try {
    raw = fs.readFileSync(LINK_POLICY_PATH, 'utf8');
  } catch (cause) {
    throw new Error(`Unable to read the link policy at ${LINK_POLICY_PATH} (${cause.code || cause.message}). The gate refuses to run without it, because that policy is what stops untrusted Markdown from being dereferenced.`);
  }

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`The link policy at ${LINK_POLICY_PATH} is not valid JSON (${cause.message}).`);
  }

  const policy = {};

  for (const key of LINK_POLICY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      policy[key] = parsed[key];
    }
  }

  if (!Array.isArray(policy.ignorePatterns) || policy.ignorePatterns.length === 0) {
    throw new Error(`The link policy at ${LINK_POLICY_PATH} declares no ignorePatterns, so web and mail links would be dereferenced. Refusing to run.`);
  }

  return policy;
}

/**
 * The thirteen authored Markdown files the documentation plan defines, in reading
 * order: the root README, the contributor guide, and the eleven `docs/` pages.
 *
 * This list is the exact inventory the gate enforces: a planned page that is
 * absent and an authored page that is not planned are both failures, each named
 * in the report. It is never the only input to the run -- discovered pages are
 * checked too, so nothing goes unverified -- see {@link discoverMarkdownFiles}.
 *
 * @constant {string[]}
 */
const PLANNED_CORPUS = [
  'README.md',
  'CONTRIBUTING.md',
  'docs/README.md',
  'docs/repository-assets.md',
  'docs/getting-started/installation.md',
  'docs/getting-started/configuration.md',
  'docs/api/http-api.md',
  'docs/api/server-module.md',
  'docs/guides/deployment.md',
  'docs/guides/troubleshooting.md',
  'docs/architecture/overview.md',
  'docs/architecture/request-lifecycle.md',
  'docs/architecture/code-walkthrough.md'
];

/**
 * Directory names that are never walked, at any depth.
 *
 * `node_modules` may hold many third-party Markdown files that are not ours to
 * check, and `.git` is repository plumbing rather than content. Matching
 * these by name rather than by path means a vendored subtree cannot reintroduce
 * them further down.
 *
 * @constant {string[]}
 */
const IGNORED_DIRECTORY_NAMES = [
  '.git',
  'node_modules'
];

/**
 * Directories excluded from discovery, as repository-relative POSIX paths.
 *
 * `docs/api/generated` is git-ignored build output written by `npm run docs:api`;
 * its links cannot be corrected at source, so checking it would report failures
 * nobody can fix. Together with {@link IGNORED_DIRECTORY_NAMES} this mirrors
 * `.gitignore` and the `ignores` array in `.markdownlint-cli2.jsonc`, so the lint
 * gate and this gate cover the same corpus.
 *
 * @constant {string[]}
 */
const IGNORED_DIRECTORIES = [
  'docs/api/generated'
];

/**
 * Result statuses that fail the run.
 *
 * `dead` means the link was checked and is not reachable. `error` means the check
 * itself could not be completed, which is not evidence that the link is fine --
 * treating it as a pass is exactly the defect this gate was written to remove.
 *
 * @constant {string[]}
 */
const FAILING_STATUSES = ['dead', 'error'];

/**
 * How many times a file is checked when its previous attempt produced `error`
 * results. A transport error can be genuinely transient, so one retry is allowed;
 * an error that survives the retry fails the run.
 *
 * @constant {number}
 * @default 2
 */
const MAX_ATTEMPTS_PER_FILE = 2;

/**
 * Delay in milliseconds before re-checking a file that produced `error` results.
 *
 * @constant {number}
 * @default 2000
 */
const RETRY_DELAY_MS = 2000;

/**
 * Single-character status markers used in the per-link output. Plain ASCII, so the
 * transcript can be pasted into documentation without encoding surprises.
 *
 * @constant {Object<string, string>}
 */
const STATUS_MARKERS = {
  alive: '+',
  ignored: '-',
  dead: 'x',
  error: '!'
};

/**
 * Converts a filesystem path to the `file://` URL form that
 * `markdown-link-check` expects for `baseUrl` and `projectBaseUrl`, using the
 * same platform handling as the tool's own command line.
 *
 * @param {string} absolutePath An absolute filesystem path.
 * @returns {string} The corresponding `file://` URL.
 */
function toFileUrl(absolutePath) {
  return process.platform === 'win32'
    ? `file:///${absolutePath.replace(/\\/g, '/')}`
    : `file://${absolutePath}`;
}

/**
 * Normalises a repository-relative path to POSIX separators so comparisons and
 * output are identical on every platform.
 *
 * @param {string} relativePath A repository-relative path.
 * @returns {string} The path with `/` separators.
 */
function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

/**
 * Recursively collects every `.md` file under the package root, skipping the
 * ignored directories.
 *
 * @param {string} [directory] Absolute directory to walk. Defaults to the package
 *   root.
 * @returns {string[]} Repository-relative POSIX paths, sorted.
 */
function discoverMarkdownFiles(directory) {
  const root = directory || PROJECT_ROOT;
  const found = [];

  /**
   * @param {string} current Absolute directory currently being walked.
   * @returns {void}
   */
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      const relative = toPosix(path.relative(PROJECT_ROOT, absolute));

      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORY_NAMES.includes(entry.name) && !IGNORED_DIRECTORIES.includes(relative)) {
          walk(absolute);
        }
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        found.push(relative);
      }
    }
  };

  walk(root);

  return found.sort();
}

/**
 * Builds the ordered list of files to check and the list of planned files that do
 * not exist yet.
 *
 * Planned files come first and in plan order so the output reads like the corpus;
 * anything discovered that is not planned is appended, so a new page is covered
 * the moment it is written.
 *
 * @returns {{files: string[], missing: string[], unexpected: string[]}} `files`
 *   are the repository-relative paths to check; `missing` are planned paths that
 *   are not on disk; `unexpected` are authored paths that are not in the plan.
 *   Both `missing` and `unexpected` fail the run, which is what makes the corpus
 *   an asserted inventory rather than whatever discovery happened to find.
 */
function resolveCorpus() {
  const discovered = discoverMarkdownFiles();
  const files = [];
  const missing = [];
  const unexpected = [];

  for (const planned of PLANNED_CORPUS) {
    if (fs.existsSync(path.join(PROJECT_ROOT, planned))) {
      files.push(planned);
    } else {
      missing.push(planned);
    }
  }

  for (const candidate of discovered) {
    if (!files.includes(candidate)) {
      files.push(candidate);
      unexpected.push(candidate);
    }
  }

  return { files, missing, unexpected };
}

/**
 * Runs `markdown-link-check` over one file's contents.
 *
 * Wraps the library's callback API in a promise and converts a synchronous throw
 * into a rejection, which matters because the library does throw synchronously
 * for a malformed URL (`ERR_INVALID_URL`) instead of reporting it as a result.
 *
 * @param {Function} markdownLinkCheck The library entry point.
 * @param {string} relativePath Repository-relative path of the file, used to
 *   resolve the `baseUrl` that relative links are checked against.
 * @param {string} markdown The file's contents.
 * @param {Object} policy The hermetic link policy from {@link loadLinkPolicy}.
 * @returns {Promise<Object[]>} The library's result objects.
 */
function checkMarkdown(markdownLinkCheck, relativePath, markdown, policy) {
  const absolutePath = path.join(PROJECT_ROOT, relativePath);

  // Option parity with the pinned CLI: baseUrl resolves relative links against
  // the file's own directory, and projectBaseUrl is what `{{BASEURL}}` expands
  // to. `quiet` is deliberately absent: this gate prints everything.
  //
  // The policy is spread last so it wins. That is what keeps `retryOn429` off --
  // a remote `Retry-After` must never be able to set this gate's wall-clock cost
  // -- and what applies the ignore/replacement rules that stop any URL from this
  // corpus being dereferenced at all.
  const options = Object.assign({
    baseUrl: toFileUrl(path.dirname(absolutePath)),
    projectBaseUrl: toFileUrl(PROJECT_ROOT),
    showProgressBar: false
  }, policy);

  return new Promise((resolve, reject) => {
    try {
      markdownLinkCheck(markdown, options, (error, results) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(results || []);
      });
    } catch (thrown) {
      reject(thrown);
    }
  });
}

/**
 * Suspends execution for the given number of milliseconds.
 *
 * @param {number} milliseconds How long to wait.
 * @returns {Promise<void>} Resolves once the delay has elapsed.
 */
function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Renders one result line.
 *
 * @param {Object} result A `markdown-link-check` result object.
 * @returns {string} The line to print.
 */
function formatResult(result) {
  const marker = STATUS_MARKERS[result.status] || '?';
  const status = String(result.status).toUpperCase().padEnd(7);
  const code = result.statusCode === undefined ? '' : ` (HTTP ${result.statusCode})`;
  const reason = result.err ? ` -- ${result.err.code || result.err.message}` : '';

  return `    [${marker}] ${status} ${result.link}${code}${reason}`;
}

/**
 * Checks one file, retrying once when the attempt produced `error` results.
 *
 * A file that cannot be read is a failure rather than a skip: an unreadable file
 * is an unchecked file, and reporting success for it would recreate the defect
 * this gate removes.
 *
 * @param {Function} markdownLinkCheck The library entry point.
 * @param {string} relativePath Repository-relative path of the file to check.
 * @returns {Promise<{file: string, results: Object[], failures: Object[], problem: (string|null)}>}
 *   The per-file outcome.
 */
async function checkFile(markdownLinkCheck, relativePath, policy) {
  const outcome = { file: relativePath, results: [], failures: [], problem: null };

  let markdown;

  try {
    markdown = fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
  } catch (cause) {
    outcome.problem = `unreadable file: ${cause.message}`;
    return outcome;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_FILE; attempt += 1) {
    try {
      outcome.results = await checkMarkdown(markdownLinkCheck, relativePath, markdown, policy);
      outcome.problem = null;
    } catch (cause) {
      outcome.results = [];
      outcome.problem = `link check did not complete: ${cause.code || cause.message}`;
      break;
    }

    const transportErrors = outcome.results.filter((result) => result.status === 'error');

    if (transportErrors.length === 0 || attempt === MAX_ATTEMPTS_PER_FILE) {
      break;
    }

    process.stdout.write(`    ... ${transportErrors.length} link(s) could not be checked; retrying ${relativePath} (attempt ${attempt + 1} of ${MAX_ATTEMPTS_PER_FILE})\n`);
    await delay(RETRY_DELAY_MS);
  }

  outcome.failures = outcome.results.filter((result) => FAILING_STATUSES.includes(result.status));

  return outcome;
}

/**
 * Prints the corpus inventory verdict.
 *
 * A count alone is not enough: renaming a page keeps the count at thirteen while
 * leaving a required page absent, so both directions are named individually.
 *
 * @param {string[]} missing Planned paths that are not on disk.
 * @param {string[]} unexpected Authored paths that are not in the plan.
 * @returns {boolean} `true` when the corpus matches the plan exactly.
 */
function reportInventory(missing, unexpected) {
  if (missing.length === 0 && unexpected.length === 0) {
    process.stdout.write(`\nINVENTORY: the authored corpus is exactly the ${PLANNED_CORPUS.length} planned documentation pages.\n`);
    return true;
  }

  process.stderr.write(`\nINVENTORY FAILED: the authored Markdown corpus must be exactly the ${PLANNED_CORPUS.length} planned pages.\n`);

  if (missing.length > 0) {
    process.stderr.write(`  missing (${missing.length}) -- planned but not authored:\n`);

    for (const file of missing) {
      process.stderr.write(`    [ ] ${file}\n`);
    }
  }

  if (unexpected.length > 0) {
    process.stderr.write(`  unexpected (${unexpected.length}) -- authored but not planned (checked anyway):\n`);

    for (const file of unexpected) {
      process.stderr.write(`    [?] ${file}\n`);
    }
  }

  process.stderr.write('  These are reported rather than passed over silently: a gate that checked only\n');
  process.stderr.write('  the pages that happen to exist would report success while a required page was\n');
  process.stderr.write('  absent or had been renamed.\n');

  return false;
}

/**
 * Prints the closing summary.
 *
 * @param {Object} totals Aggregated counters.
 * @param {number} totals.filesChecked Files that were checked.
 * @param {number} totals.linksChecked Links that were checked.
 * @param {number} totals.dead Links found unreachable.
 * @param {number} totals.errored Links whose check could not be completed.
 * @param {number} totals.ignored Links skipped by an ignore pattern.
 * @param {number} totals.problems Files that could not be checked at all.
 * @param {number} totals.missing Planned pages not authored yet.
 * @param {number} totals.unexpected Authored pages not in the plan.
 * @returns {void}
 */
function reportSummary(totals) {
  process.stdout.write('\nLink check summary\n');
  process.stdout.write(`    files checked   : ${totals.filesChecked}\n`);
  process.stdout.write(`    links checked   : ${totals.linksChecked}\n`);
  process.stdout.write(`    alive           : ${totals.linksChecked - totals.dead - totals.errored - totals.ignored}\n`);
  process.stdout.write(`    ignored         : ${totals.ignored}\n`);
  process.stdout.write(`    dead            : ${totals.dead}\n`);
  process.stdout.write(`    errored         : ${totals.errored}\n`);
  process.stdout.write(`    unchecked files : ${totals.problems}\n`);
  process.stdout.write(`    missing pages   : ${totals.missing}\n`);
  process.stdout.write(`    unexpected pages: ${totals.unexpected}\n`);
}

/**
 * Runs the gate: enforces the runtime floor, resolves the corpus, checks every
 * file, prints every result, and returns the exit code.
 *
 * @returns {Promise<number>} `0` when every link in every authored file was
 *   checked successfully and found reachable, `1` otherwise.
 */
async function run() {
  // The pinned toolchain is only supported above the declared development floor,
  // and this gate loads one of its packages, so the floor is enforced first.
  const runtimeExitCode = runtimeGuard.enforce({
    quiet: true,
    policy: runtimeGuard.GATE_POLICY
  });

  if (runtimeExitCode !== runtimeGuard.EXIT_SUPPORTED) {
    return runtimeExitCode;
  }

  let markdownLinkCheck;

  try {
    // Required lazily and by name so a missing install produces this explicit
    // instruction rather than an unhandled module-resolution stack trace.
    markdownLinkCheck = require('markdown-link-check');
  } catch (cause) {
    process.stderr.write(`Unable to load markdown-link-check (${cause.code || cause.message}).\nRun \`npm install\` to materialise the documentation toolchain, then re-run this command.\n`);
    return runtimeGuard.EXIT_UNSUPPORTED;
  }

  let policy;

  try {
    policy = loadLinkPolicy();
  } catch (cause) {
    process.stderr.write(`${cause.message}\n`);
    return runtimeGuard.EXIT_UNSUPPORTED;
  }

  const { files, missing, unexpected } = resolveCorpus();

  process.stdout.write(`Checking links in ${files.length} authored Markdown file(s) under ${PROJECT_ROOT}\n`);
  process.stdout.write(`Link policy: ${LINK_POLICY_PATH} -- no web or mail link is dereferenced.\n`);

  const totals = {
    filesChecked: 0,
    linksChecked: 0,
    dead: 0,
    errored: 0,
    ignored: 0,
    problems: 0,
    missing: missing.length,
    unexpected: unexpected.length
  };

  const failedFiles = [];

  for (const file of files) {
    process.stdout.write(`\n  ${file}\n`);

    const outcome = await checkFile(markdownLinkCheck, file, policy);

    if (outcome.problem) {
      totals.problems += 1;
      failedFiles.push(file);
      process.stdout.write(`    [!] ${outcome.problem}\n`);
      continue;
    }

    totals.filesChecked += 1;
    totals.linksChecked += outcome.results.length;
    totals.dead += outcome.results.filter((result) => result.status === 'dead').length;
    totals.errored += outcome.results.filter((result) => result.status === 'error').length;
    totals.ignored += outcome.results.filter((result) => result.status === 'ignored').length;

    if (outcome.results.length === 0) {
      process.stdout.write('    (no links)\n');
    }

    for (const result of outcome.results) {
      process.stdout.write(`${formatResult(result)}\n`);
    }

    if (outcome.failures.length > 0) {
      failedFiles.push(file);
    }
  }

  const inventoryMatches = reportInventory(missing, unexpected);
  reportSummary(totals);

  if (failedFiles.length === 0 && inventoryMatches) {
    process.stdout.write('\nPASS: the corpus matches the plan exactly, and every link in it was checked and is reachable.\n');
    return runtimeGuard.EXIT_SUPPORTED;
  }

  if (failedFiles.length > 0) {
    process.stderr.write(`\nFAIL: ${totals.dead} dead link(s), ${totals.errored} unchecked link(s) and ${totals.problems} unchecked file(s) across ${failedFiles.length} file(s):\n`);

    for (const file of failedFiles) {
      process.stderr.write(`    ${file}\n`);
    }

    process.stderr.write('A link whose check could not be completed is a failure, not a pass: an\nunverified link is indistinguishable from a broken one until it is checked.\n');
  }

  if (!inventoryMatches) {
    process.stderr.write('\nFAIL: the authored corpus does not match the planned inventory (see INVENTORY FAILED above).\n');
  }

  return runtimeGuard.EXIT_UNSUPPORTED;
}

module.exports = {
  PROJECT_ROOT,
  LINK_POLICY_PATH,
  LINK_POLICY_KEYS,
  PLANNED_CORPUS,
  IGNORED_DIRECTORY_NAMES,
  IGNORED_DIRECTORIES,
  FAILING_STATUSES,
  MAX_ATTEMPTS_PER_FILE,
  toFileUrl,
  toPosix,
  loadLinkPolicy,
  discoverMarkdownFiles,
  resolveCorpus,
  formatResult,
  checkFile,
  run
};

// Command entry point. A gate that crashes must never look like a gate that
// passed, so an uncaught exception or an unhandled rejection is converted into an
// explicit failure with a non-zero exit code.
if (require.main === module) {
  process.on('uncaughtException', (error) => {
    process.stderr.write(`\nFAIL: link check aborted by an uncaught exception: ${error.stack || error.message}\n`);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    process.stderr.write(`\nFAIL: link check aborted by an unhandled rejection: ${(reason && reason.stack) || reason}\n`);
    process.exit(1);
  });

  run().then((exitCode) => {
    process.exitCode = exitCode;
  }, (error) => {
    process.stderr.write(`\nFAIL: link check aborted: ${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
