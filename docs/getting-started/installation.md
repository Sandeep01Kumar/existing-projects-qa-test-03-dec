# Installation

Everything needed to go from a machine with Node.js on it to a running service
that answers a request. This page owns the **runtime baseline** for the whole
documentation corpus: every other page cites the values below rather than
declaring its own.

Source files this page derives from: `package.json`, `package-lock.json`,
`server.js`.

## Prerequisites

Node.js is the only prerequisite. Nothing else is required — not a compiler, not
a database, not a container runtime.

| Item | Value | Where it comes from |
| --- | --- | --- |
| Node.js floor | `>=18` | Declared in `package.json` as `engines.node`. Chosen for the core `http` API surface `server.js` uses |
| Node.js verified | `v22.23.2` | The version this documentation was authored and verified against |
| npm verified | `11.18.0` | Used for every install and script run quoted here |
| Documentation toolchain floor | `>=22.12.0` | Declared in `package.json` as `devEngines.runtime`. Applies to the `docs:*` scripts only, never to running the service |

The floor is the contract; the verified versions are an observation. Two floors
exist because they protect different things: `engines.node` is the floor for
running `server.js`, while `devEngines.runtime` is the floor for the JSDoc and
Markdown tooling, which is newer software with newer requirements. Running the
service on Node 18 is supported; building the documentation on Node 18 is not.

## Verifying your toolchain

```bash
node --version
npm --version
```

Captured output:

```text
v22.23.2
11.18.0
```

If your Node.js is older than `>=18`, upgrade before going further — see
[When your Node.js is older than the floor](#when-your-nodejs-is-older-than-the-floor).

## Obtaining the repository

Clone it and change into the directory. The clone URL depends on the host you
are cloning from, so substitute your own remote:

```bash
git clone <repository-url>
cd hao-backprop-test
```

## Installing dependencies

```bash
npm install
```

Captured output:

```text
added 178 packages, and audited 179 packages in 1s

77 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

Two things about that command are worth being explicit about, because both
surprise people.

**Everything it installed is documentation tooling.** The manifest declares no
`dependencies` block at all. Its three `devDependencies` — `jsdoc`,
`markdownlint-cli2`, and `markdown-link-check` — generate and check this
documentation; 178 packages is those three plus their transitive tree.

**The service needs none of it.** You can confirm that without uninstalling
anything:

```bash
npm ls --omit=dev --depth=0
```

Captured output:

```text
hello_world@1.0.0 /path/to/hao-backprop-test
└── (empty)
```

An empty runtime tree is the point: `server.js` imports only Node's built-in
`http` module at `server.js:L1`, so the application has zero runtime
dependencies and `node server.js` works on a fresh clone with no `node_modules`
directory present. Install only if you intend to build or lint the
documentation.

For a reproducible install from the lockfile alone — what continuous integration
should use — run `npm ci` instead. It installs exactly what
`package-lock.json` pins and refuses to run if the lockfile and the manifest
have drifted apart.

## Running the server

Either command works, and they do the same thing:

```bash
node server.js
```

```bash
npm start
```

Captured output from `node server.js`, exactly one line:

```text
Server running at http://127.0.0.1:3000/
```

Captured output from `npm start`, which adds npm's own two-line preamble:

```text
> hello_world@1.0.0 start
> node server.js

Server running at http://127.0.0.1:3000/
```

The banner is printed by the startup callback once the socket is bound, and its
text is interpolated from the two configuration constants. Source:
`server.js:L12-L14`. Seeing it means the listener is accepting connections.

## Verifying the install

With the server running, in a second terminal:

```bash
curl -i http://127.0.0.1:3000/
```

Captured output:

```http
HTTP/1.1 200 OK
Content-Type: text/plain
Date: Tue, 04 Aug 2026 14:50:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 14

Hello, World!
```

Only the `Date` header differs between runs, because its value advances with the
clock. A `200` with a 14-byte `text/plain` body is a successful install. The
full contract, including what happens for other paths and methods, is in
[../api/http-api.md](../api/http-api.md).

## Stopping the server

Press `Ctrl+C` in the terminal running it. That is an immediate termination: the
module installs no signal handler and performs no graceful shutdown, so
in-flight requests are dropped and no cleanup runs.

## When your Node.js is older than the floor

`engines.node` is advisory to npm by default, so an old runtime does not
necessarily refuse to install — it fails later, and less clearly, usually as a
syntax error. Upgrade with whatever version manager you already use, then
re-check with `node --version`. The `docs:*` scripts are stricter: they run a
preflight check that fails closed below `devEngines.runtime`, so a documentation
build tells you the exact reason rather than producing broken output:

```bash
npm run docs:preflight
```

Captured output on a supported runtime:

```text
documentation toolchain runtime check: node v22.23.2 satisfies devEngines.runtime ">=22.12.0"
```

## See also

- [../../README.md](../../README.md) — the canonical overview, whose
  Prerequisites and Installation sections this page expands.
- [configuration.md](configuration.md) — the two configuration constants and how
  to change them.
- [../api/http-api.md](../api/http-api.md) — the HTTP contract you just
  verified.
- [../guides/troubleshooting.md](../guides/troubleshooting.md) — what to do when
  a step above does not behave as described.
