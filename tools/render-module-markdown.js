#!/usr/bin/env node
'use strict';

/**
 * @file Renders the code-level module reference of `server.js` to Markdown, using
 * nothing but the documentation toolchain that `npm ci` already installs.
 *
 * @module tools/render-module-markdown
 *
 * @description
 * This script backs `npm run docs:md`. It exists because that script must satisfy
 * three constraints at once, and no off-the-shelf invocation satisfies all three:
 *
 * 1. **The script must render the module reference to Markdown.** The
 *    documentation plan lists `docs:md` among the documentation commands the
 *    manifest provides, so the command has to do real work.
 * 2. **`jsdoc-to-markdown` must not become a dependency.** The plan records it as
 *    optional and deliberately not adopted, because the authored reference at
 *    `docs/api/server-module.md` is written by hand and readable without any
 *    build; the generator only automates keeping a rendered copy in sync.
 * 3. **A defined script must be self-contained under `npm ci`.** Reaching for an
 *    undeclared package at run time -- `npx --yes <package>@<version>` -- fails on
 *    an air-gapped machine or a cold cache, and silently resolves a tree of
 *    packages that no lockfile pins. A command that only works when the network
 *    happens to be up is not reproducible, and a command that installs unpinned
 *    code during a documentation build is a supply-chain hazard.
 *
 * The way out is that the reference does not need a second generator at all. The
 * pinned `jsdoc` package already parses `server.js` and can emit its complete
 * doclet set as JSON with `-X`; this script consumes that JSON and formats it. So
 * the rendering runs entirely from `node_modules`, opens no socket, and adds no
 * dependency -- required, optional or transitive.
 *
 * ## Why the generator is re-invoked without the Markdown plugin
 *
 * `jsdoc.json` enables `plugins/markdown` so that the generated HTML renders the
 * Markdown written inside doc comments. That plugin rewrites every description in
 * place, so with it enabled `-X` returns HTML fragments such as
 * `<p>…<code>x</code></p>`. Emitting those into a Markdown document would bury
 * HTML in the output for no reason. This script therefore derives an in-memory
 * copy of `jsdoc.json` with `plugins` removed and hands that to the generator, so
 * descriptions come back as the Markdown their authors actually wrote. Every other
 * setting -- `source.include`, `includePattern`, `excludePattern` and the strict
 * `tags` dictionary -- is inherited unchanged, so this script and `npm run
 * docs:api` always read exactly the same input under exactly the same rules.
 *
 * ## Why the output is written through a temporary file
 *
 * A shell redirect (`… > out.md`) creates and truncates its target *before* the
 * command on the left runs, so a failing command leaves an empty file behind that
 * looks like real output and silently replaces a good previous rendering. This
 * script writes to a uniquely named temporary file in the destination directory
 * and renames it into place only after the whole document has been produced.
 * `fs.renameSync` within one directory is atomic on every supported platform, so a
 * reader never observes a partial file, and a failed run leaves the previous
 * rendering exactly as it was.
 *
 * @requires fs
 * @requires os
 * @requires path
 * @requires child_process
 * @requires module:tools/check-doc-runtime
 *
 * @author hxu
 * @license MIT
 * @since 1.0.0
 *
 * @example
 * // Render the module reference from the repository root:
 * //   $ npm run docs:md
 * //
 * // Writes docs/api/generated/server-module.md, which is git-ignored build
 * // output. The authored reference is docs/api/server-module.md.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const runtimeGuard = require('./check-doc-runtime.js');

/**
 * Absolute path of the package root, derived from this file's own location so the
 * script behaves identically however it is invoked -- through `npm run`, by an
 * absolute path, or from any working directory.
 *
 * @constant {string}
 */
const PROJECT_ROOT = path.join(__dirname, '..');

/**
 * Absolute path of the JSDoc configuration this script inherits.
 *
 * Reading the same file `npm run docs:api` reads is what keeps the two commands
 * describing the same sources under the same rules.
 *
 * @constant {string}
 */
const JSDOC_CONFIG_PATH = path.join(PROJECT_ROOT, 'jsdoc.json');

/**
 * Name of the rendered document, relative to the generated-output directory.
 *
 * @constant {string}
 */
const OUTPUT_FILENAME = 'server-module.md';

/**
 * Destination directory used when `jsdoc.json` declares no `opts.destination`.
 *
 * The path is git-ignored, which is what keeps generated output out of the
 * repository and stops an authored link from ever pointing at it.
 *
 * @constant {string}
 */
const DEFAULT_DESTINATION = 'docs/api/generated';

/**
 * Doclet kinds that are rendered, in the order their sections appear.
 *
 * `member` and `function` doclets that JSDoc infers from the code without a doc
 * comment are excluded by the `undocumented` filter rather than by kind, so an
 * annotation added later is picked up without editing this list.
 *
 * @constant {string[]}
 */
const RENDERED_KINDS = ['module', 'constant', 'typedef'];

/**
 * Maximum number of bytes accepted from the generator's stdout.
 *
 * The default `spawnSync` buffer is 1 MiB, and a doclet dump of a thoroughly
 * annotated module can exceed that. 64 MiB is far above anything this repository
 * can produce while still bounding memory if the generator ever misbehaves.
 *
 * @constant {number}
 * @default 67108864
 */
const MAX_GENERATOR_OUTPUT_BYTES = 64 * 1024 * 1024;

/**
 * Reads and parses `jsdoc.json`.
 *
 * @returns {Object} The parsed configuration.
 * @throws {Error} When the file cannot be read or is not valid JSON. Either
 *   condition is fatal: rendering against a guessed configuration would describe
 *   sources the real toolchain does not read.
 */
function readJsdocConfig() {
  let raw;

  try {
    raw = fs.readFileSync(JSDOC_CONFIG_PATH, 'utf8');
  } catch (cause) {
    throw new Error(`Unable to read the JSDoc configuration at ${JSDOC_CONFIG_PATH} (${cause.code || cause.message}).`);
  }

  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new Error(`The JSDoc configuration at ${JSDOC_CONFIG_PATH} is not valid JSON (${cause.message}).`);
  }
}

/**
 * Resolves the absolute directory the rendered document is written to.
 *
 * @param {Object} config The parsed JSDoc configuration.
 * @returns {string} Absolute path of the generated-output directory.
 */
function resolveDestination(config) {
  const declared = config && config.opts && typeof config.opts.destination === 'string'
    ? config.opts.destination
    : DEFAULT_DESTINATION;

  return path.resolve(PROJECT_ROOT, declared);
}

/**
 * Runs the locally installed JSDoc generator in explain mode and returns its
 * doclets.
 *
 * The generator is located with `require.resolve` and executed with the current
 * `process.execPath`, so resolution never depends on `PATH`, on a shell, or on a
 * globally installed binary: if `npm ci` put the package in `node_modules`, this
 * works, and if it did not, the failure names the missing package instead of
 * producing an obscure spawn error.
 *
 * @returns {Object[]} The doclet objects JSDoc emitted.
 * @throws {Error} When the generator is not installed, exits non-zero, or emits
 *   output that is not the expected JSON array.
 */
function collectDoclets() {
  const config = readJsdocConfig();
  const explainConfig = Object.assign({}, config);

  // The Markdown plugin rewrites every description into HTML in place. Dropping it
  // for this run is what keeps descriptions as the Markdown they were written as;
  // nothing else about the configuration changes.
  delete explainConfig.plugins;

  let generatorPath;

  try {
    generatorPath = require.resolve('jsdoc/jsdoc.js');
  } catch (cause) {
    throw new Error(`Unable to locate the jsdoc package (${cause.code || cause.message}).\nRun \`npm install\` to materialise the documentation toolchain, then re-run this command.`);
  }

  const temporaryConfigPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'jsdoc-explain-')),
    'jsdoc-explain.json'
  );

  try {
    fs.writeFileSync(temporaryConfigPath, `${JSON.stringify(explainConfig, null, 2)}\n`, 'utf8');

    const result = spawnSync(
      process.execPath,
      [generatorPath, '--explain', '--configure', temporaryConfigPath],
      {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
        maxBuffer: MAX_GENERATOR_OUTPUT_BYTES
      }
    );

    if (result.error) {
      throw new Error(`Unable to run the JSDoc generator (${result.error.code || result.error.message}).`);
    }

    if (result.status !== 0) {
      const detail = (result.stderr || '').trim() || `exit code ${result.status}`;
      throw new Error(`The JSDoc generator failed, so no reference was rendered:\n${detail}`);
    }

    let doclets;

    try {
      doclets = JSON.parse(result.stdout);
    } catch (cause) {
      throw new Error(`The JSDoc generator did not emit valid JSON (${cause.message}).`);
    }

    if (!Array.isArray(doclets)) {
      throw new Error('The JSDoc generator emitted JSON that is not an array of doclets.');
    }

    return doclets;
  } finally {
    // Best-effort cleanup of the derived configuration. A leftover file in the
    // system temporary directory must never be able to fail a documentation build,
    // so the removal is deliberately not allowed to throw.
    fs.rmSync(path.dirname(temporaryConfigPath), { recursive: true, force: true });
  }
}

/**
 * Selects the doclets worth rendering and orders them deterministically.
 *
 * Three groups are dropped. Doclets JSDoc inferred from the code without a doc
 * comment carry `undocumented: true` and would otherwise appear as empty entries;
 * the synthetic `package` doclet describes `package.json` rather than the module;
 * and anything marked `@ignore` was explicitly excluded by its author. What
 * remains is sorted by source line so two runs over unchanged sources produce
 * byte-identical output apart from nothing at all -- the document carries no
 * timestamp, precisely so it can be compared.
 *
 * @param {Object[]} doclets The raw doclets from {@link collectDoclets}.
 * @returns {Object[]} The doclets to render, in source order within each kind.
 */
function selectDoclets(doclets) {
  const lineOf = (doclet) => (doclet.meta && typeof doclet.meta.lineno === 'number' ? doclet.meta.lineno : 0);

  return doclets
    .filter((doclet) => doclet
      && !doclet.undocumented
      && !doclet.ignore
      && RENDERED_KINDS.includes(doclet.kind))
    .sort((left, right) => {
      const byKind = RENDERED_KINDS.indexOf(left.kind) - RENDERED_KINDS.indexOf(right.kind);

      return byKind === 0 ? lineOf(left) - lineOf(right) : byKind;
    });
}

/**
 * Collapses a doclet description into Markdown that is safe to place inside a
 * table cell.
 *
 * Table cells cannot contain a newline, and an unescaped pipe would end the cell
 * early, so both are neutralised. Everything else -- inline code, emphasis, links
 * -- is left intact, because it renders correctly in a cell.
 *
 * @param {string} [text] The description to collapse.
 * @returns {string} A single-line Markdown fragment, or an em dash when there is
 *   no description to show.
 */
function toTableCell(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return '--';
  }

  return text
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

/**
 * Formats a doclet's type names as inline code.
 *
 * @param {Object} [type] A doclet `type` object.
 * @returns {string} The type names joined with `|`, or an em dash when the doclet
 *   declares no type.
 */
function formatType(type) {
  const names = type && Array.isArray(type.names) ? type.names.filter(Boolean) : [];

  return names.length === 0 ? '--' : names.map((name) => `\`${name}\``).join(' \\| ');
}

/**
 * Renders one `@example` block as a fenced JavaScript code block.
 *
 * The fence carries an explicit language hint because every other document in
 * this repository does; consistency matters more here than brevity.
 *
 * @param {string} example The example source.
 * @returns {string[]} The lines of the fenced block.
 */
function renderExample(example) {
  return ['```javascript', ...String(example).replace(/\s+$/, '').split(/\r?\n/), '```', ''];
}

/**
 * Renders the module-level doclet: its description and its metadata table.
 *
 * @param {Object} doclet The `module` doclet.
 * @returns {string[]} Markdown lines.
 */
function renderModule(doclet) {
  const lines = [`# Module: ${doclet.name}`, ''];

  lines.push(
    'Generated code-level reference, rendered from the JSDoc annotations in',
    '`server.js` by `npm run docs:md`. This file is build output: it is',
    'git-ignored and regenerated on demand. The authored, hand-written reference',
    'is `docs/api/server-module.md`.',
    ''
  );

  if (doclet.description) {
    lines.push('## Description', '', doclet.description.trim(), '');
  }

  const metadata = [];

  if (Array.isArray(doclet.requires) && doclet.requires.length > 0) {
    metadata.push(['Requires', doclet.requires.map((entry) => `\`${entry}\``).join(', ')]);
  }

  if (Array.isArray(doclet.author) && doclet.author.length > 0) {
    metadata.push(['Author', doclet.author.join(', ')]);
  }

  if (doclet.license) {
    metadata.push(['License', doclet.license]);
  }

  if (doclet.since) {
    metadata.push(['Since', doclet.since]);
  }

  if (doclet.meta && typeof doclet.meta.lineno === 'number') {
    metadata.push(['Declared at', `\`${doclet.meta.filename || 'server.js'}\` line ${doclet.meta.lineno}`]);
  }

  if (metadata.length > 0) {
    lines.push('## Module metadata', '', '| Field | Value |', '| --- | --- |');

    for (const [field, value] of metadata) {
      lines.push(`| ${field} | ${toTableCell(value)} |`);
    }

    lines.push('');
  }

  if (Array.isArray(doclet.see) && doclet.see.length > 0) {
    lines.push('## References', '');

    for (const reference of doclet.see) {
      lines.push(`- ${toTableCell(reference)}`);
    }

    lines.push('');
  }

  if (Array.isArray(doclet.examples) && doclet.examples.length > 0) {
    lines.push('## Module example', '');

    for (const example of doclet.examples) {
      lines.push(...renderExample(example));
    }
  }

  return lines;
}

/**
 * Renders the constants section: a summary table followed by one subsection per
 * constant.
 *
 * @param {Object[]} constants The `constant` doclets, in source order.
 * @returns {string[]} Markdown lines, or an empty array when there are none.
 */
function renderConstants(constants) {
  if (constants.length === 0) {
    return [];
  }

  const lines = ['## Constants', '', '| Name | Type | Default | Declared at |', '| --- | --- | --- | --- |'];

  for (const doclet of constants) {
    const declaredAt = doclet.meta && typeof doclet.meta.lineno === 'number' ? `line ${doclet.meta.lineno}` : '--';
    const defaultValue = doclet.defaultvalue === undefined ? '--' : `\`${doclet.defaultvalue}\``;

    lines.push(`| \`${doclet.name}\` | ${formatType(doclet.type)} | ${defaultValue} | ${declaredAt} |`);
  }

  lines.push('');

  for (const doclet of constants) {
    lines.push(`### Constant: ${doclet.name}`, '');

    if (doclet.description) {
      lines.push(doclet.description.trim(), '');
    }

    if (Array.isArray(doclet.see) && doclet.see.length > 0) {
      for (const reference of doclet.see) {
        lines.push(`See also: ${toTableCell(reference)}`, '');
      }
    }

    if (Array.isArray(doclet.examples) && doclet.examples.length > 0) {
      for (const example of doclet.examples) {
        lines.push(...renderExample(example));
      }
    }
  }

  return lines;
}

/**
 * Renders the type-definitions section: one subsection per `@callback` or
 * `@typedef`, with its parameter table, return value, listened-for events and
 * examples.
 *
 * These entries carry the module's two anonymous arrow functions. Both are inline
 * expressions with no identifier for a doc block to bind to, so the annotations
 * name them through `@callback` -- which is why they appear here rather than as
 * functions.
 *
 * @param {Object[]} typedefs The `typedef` doclets, in source order.
 * @returns {string[]} Markdown lines, or an empty array when there are none.
 */
function renderTypedefs(typedefs) {
  if (typedefs.length === 0) {
    return [];
  }

  const lines = ['## Type definitions', ''];

  for (const doclet of typedefs) {
    lines.push(`### ${doclet.name}`, '');

    const signature = [];

    if (doclet.meta && typeof doclet.meta.lineno === 'number') {
      signature.push(`Declared at \`${doclet.meta.filename || 'server.js'}\` line ${doclet.meta.lineno}.`);
    }

    signature.push(`Type: ${formatType(doclet.type)}.`);
    lines.push(signature.join(' '), '');

    if (doclet.description) {
      lines.push(doclet.description.trim(), '');
    }

    if (Array.isArray(doclet.params) && doclet.params.length > 0) {
      lines.push('| Parameter | Type | Description |', '| --- | --- | --- |');

      for (const parameter of doclet.params) {
        const name = parameter.name ? `\`${parameter.name}\`` : '--';

        lines.push(`| ${name} | ${formatType(parameter.type)} | ${toTableCell(parameter.description)} |`);
      }

      lines.push('');
    } else {
      lines.push('Takes no parameters.', '');
    }

    if (Array.isArray(doclet.returns) && doclet.returns.length > 0) {
      for (const returned of doclet.returns) {
        lines.push(`Returns ${formatType(returned.type)}. ${toTableCell(returned.description)}`, '');
      }
    }

    if (Array.isArray(doclet.listens) && doclet.listens.length > 0) {
      lines.push(`Listens to: ${doclet.listens.map((event) => `\`${event}\``).join(', ')}`, '');
    }

    if (Array.isArray(doclet.examples) && doclet.examples.length > 0) {
      for (const example of doclet.examples) {
        lines.push(...renderExample(example));
      }
    }
  }

  return lines;
}

/**
 * Renders the complete Markdown document for a doclet set.
 *
 * @param {Object[]} doclets The raw doclets from {@link collectDoclets}.
 * @returns {string} The document, ending in exactly one newline.
 * @throws {Error} When the doclet set contains no module doclet. That means the
 *   annotations were not parsed as expected, and emitting a reference with no
 *   module in it would be worse than failing.
 */
function renderMarkdown(doclets) {
  const selected = selectDoclets(doclets);
  const modules = selected.filter((doclet) => doclet.kind === 'module');

  if (modules.length === 0) {
    throw new Error('The generator returned no documented module, so there is nothing to render. Check that server.js still carries its @module annotation.');
  }

  const lines = [];

  for (const module of modules) {
    lines.push(...renderModule(module));
  }

  lines.push(...renderConstants(selected.filter((doclet) => doclet.kind === 'constant')));
  lines.push(...renderTypedefs(selected.filter((doclet) => doclet.kind === 'typedef')));

  // Collapse the runs of blank lines that section boundaries produce, then close
  // the file with exactly one newline. Both are Markdown conventions this
  // repository lints for elsewhere, and generated output should not be sloppier
  // than authored output just because nothing lints it.
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '')}\n`;
}

/**
 * Writes the document to its destination through a temporary file.
 *
 * The temporary file is created in the destination directory so the rename that
 * publishes it stays within one filesystem and is therefore atomic. On any
 * failure the temporary file is removed and the previous rendering is left
 * untouched, so a failed run can never leave an empty or half-written document
 * behind for a reader to mistake for real output.
 *
 * @param {string} destination Absolute path of the generated-output directory.
 * @param {string} contents The rendered document.
 * @returns {string} Absolute path of the published file.
 */
function writeAtomically(destination, contents) {
  fs.mkdirSync(destination, { recursive: true });

  const finalPath = path.join(destination, OUTPUT_FILENAME);
  const temporaryPath = path.join(destination, `.${OUTPUT_FILENAME}.${process.pid}.tmp`);

  try {
    fs.writeFileSync(temporaryPath, contents, 'utf8');
    fs.renameSync(temporaryPath, finalPath);
  } catch (cause) {
    fs.rmSync(temporaryPath, { force: true });

    throw new Error(`Unable to write ${finalPath} (${cause.code || cause.message}). Any previous rendering was left unchanged.`);
  }

  return finalPath;
}

/**
 * Runs the renderer: enforces the runtime floor, collects doclets, renders the
 * document, and publishes it.
 *
 * @returns {number} `0` on success, `1` on any failure. A non-zero exit is always
 *   accompanied by an explanation on stderr, and never by a partial file.
 */
function run() {
  // The pinned toolchain is only supported above the declared development floor,
  // and this script executes one of its packages, so the floor is enforced first.
  const runtimeExitCode = runtimeGuard.enforce({
    quiet: true,
    policy: runtimeGuard.GATE_POLICY
  });

  if (runtimeExitCode !== runtimeGuard.EXIT_SUPPORTED) {
    return runtimeExitCode;
  }

  let destination;
  let published;

  try {
    destination = resolveDestination(readJsdocConfig());
    published = writeAtomically(destination, renderMarkdown(collectDoclets()));
  } catch (cause) {
    process.stderr.write(`\nFAIL: the module reference was not rendered.\n${cause.message}\n`);

    return runtimeGuard.EXIT_UNSUPPORTED;
  }

  const bytes = fs.statSync(published).size;

  process.stdout.write(`Rendered the module reference from the JSDoc annotations in server.js\n`);
  process.stdout.write(`  generator : ${require.resolve('jsdoc/jsdoc.js')} (installed by npm, no network access)\n`);
  process.stdout.write(`  output    : ${path.relative(PROJECT_ROOT, published)} (${bytes} bytes, git-ignored build output)\n`);

  return runtimeGuard.EXIT_SUPPORTED;
}

module.exports = {
  PROJECT_ROOT,
  JSDOC_CONFIG_PATH,
  OUTPUT_FILENAME,
  DEFAULT_DESTINATION,
  RENDERED_KINDS,
  readJsdocConfig,
  resolveDestination,
  collectDoclets,
  selectDoclets,
  toTableCell,
  formatType,
  renderMarkdown,
  writeAtomically,
  run
};

// Command entry point. A build step that crashes must never look like a build step
// that succeeded, so an uncaught exception or an unhandled rejection is converted
// into an explicit failure with a non-zero exit code.
if (require.main === module) {
  process.on('uncaughtException', (error) => {
    process.stderr.write(`\nFAIL: rendering aborted by an uncaught exception: ${error.stack || error.message}\n`);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    process.stderr.write(`\nFAIL: rendering aborted by an unhandled rejection: ${(reason && reason.stack) || reason}\n`);
    process.exit(1);
  });

  process.exitCode = run();
}
