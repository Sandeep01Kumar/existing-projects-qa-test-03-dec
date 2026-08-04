# Installation

This page takes a machine that already has Node.js on it to a running service
that answers a request. It is the **owning document for the runtime baseline**:
every other page in the corpus cites the floor and the verified versions below
rather than declaring its own. Its facts come from three files — `server.js`
for what the runtime actually needs, `package.json` for the declared floor and
the scripts, and `package-lock.json` for what an install resolves. Every
command shown was executed and every transcript is the literal output it
produced.

## Prerequisites

Node.js is the only prerequisite for running the service. There is no compiler
to install, no database to provision and no container runtime to configure. Git
is needed once, to obtain the repository, and npm arrives bundled with Node.js.

| Item | Documented floor | Verified version |
| --- | --- | --- |
| Node.js — running the service | `>=18`, declared as `engines.node` | `v22.23.2` |
| npm | none declared; it ships with Node.js | `11.18.0` |
| Node.js — building the documentation | `>=22.12.0`, declared as `devEngines.runtime` | `v22.23.2` |

`Source: package.json`

The floor for running the service sits at `>=18` because Node 18 already covers
the entire core `http` API surface the module touches — `require('http')`,
`http.createServer`, `server.listen`, `res.statusCode`, `res.setHeader` and
`res.end` — and the module reaches for nothing beyond it, so no newer line is
required and the floor is not raised past 18.
`Source: server.js:L1`, `Source: server.js:L6-L10`,
`Source: server.js:L12-L14`

The floor is the contract; the verified versions are an observation. Node 18 is
supported, and being on it is not a deficiency: `v22.23.2` is simply the
version every command on this page was run against, recorded so that any
transcript here can be reproduced exactly.

The second floor exists because the documentation toolchain is newer software
with newer requirements than the service has. It applies to the `docs:*`
scripts and to nothing else, and it never affects `node server.js`. The last
section on this page,
[When your Node.js is older than the floor](#when-your-nodejs-is-older-than-the-floor),
covers both floors together.

One further version signal is worth naming so it is not mistaken for a
requirement: `package-lock.json` declares `lockfileVersion: 3`, which only npm
7 and later write. `Source: package-lock.json` That corroborates a modern npm —
any npm bundled with Node.js 18 or later qualifies — but it does not set the
floor, which `engines.node` alone does.

## Verifying your toolchain

Check the runtime first, because every later step assumes it:

```bash
node --version
```

```text
v22.23.2
```

Then check npm, which you need for every `npm run` script and for `npm start`:

```bash
npm --version
```

```text
11.18.0
```

Match the *shape*, not the exact string. Node.js prints a `v`-prefixed
semantic version and npm prints a bare one, so `v22.23.2` and `11.18.0` are
both well-formed answers. Your patch numbers will differ from the ones above
and that is expected — what matters is that your Node.js major version
satisfies the `>=18` floor. Node 18, 20, 22 and 24 all satisfy it; Node 16 and
anything older does not.

If either command reports that it is not found, Node.js is not installed or is
not on your `PATH`. Install it before going further; nothing below will work
without it.

## Obtaining the repository

Clone the repository and change into it. The clone URL depends on the host you
are cloning from, so substitute your own remote for the placeholder:

```bash
git clone <repository-url>
cd hao-backprop-test
```

`<repository-url>` is a placeholder rather than a real address, and the
directory name is whatever your remote produces, so no clone transcript is
reproduced here — there is no single true one to reproduce. Confirm you landed
in the right directory by listing it instead:

```bash
ls -1
```

```text
100Pages.pdf
CONTRIBUTING.md
LICENSE
LoginTest.java
README.md
demo.jpg
docs
industry.csv
jsdoc.json
package-lock.json
package.json
sample.doc
server.js
test.txt.txt
tools
```

Seeing `server.js` and `package.json` side by side in that listing is the check
that matters. Three configuration dotfiles sit alongside them and are hidden
from `ls -1`: `.gitignore`, `.markdownlint-cli2.jsonc` and
`.markdown-link-check.json`.

**Every command from here on is run from the repository root.** That is where
`server.js` and `package.json` live, and there is nowhere else to run them
from: the project has no `src/` directory, no build output directory and no
nested package. The application is the single top-level file.

Six of the entries above are not application code at all but deliberate
multi-format fixtures, and they must not be pruned;
[../repository-assets.md](../repository-assets.md) accounts for each one.

## Installing dependencies

Install from the repository root:

```bash
npm install
```

On a freshly cloned repository, that prints:

```text

added 178 packages, and audited 179 packages in 1s

77 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

Run it again and it prints this instead, in well under a second:

```text

up to date, audited 179 packages in 480ms

77 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

**An install that finishes almost instantly has not failed.** `up to date` is
npm's success message for "there is nothing left to do", and it is the normal
result of every install after the first. Nothing is wrong, nothing is missing
and there is nothing to retry.

The package counts in those two transcripts are stable, but the elapsed times
are not: they are whatever the captured run took, and yours will differ. Read
`1s` and `480ms` as evidence of the shape of the result, not as figures to
match.

There is a stronger version of the same result. Ask npm for the runtime
dependencies alone and it has nothing whatsoever to install:

```bash
npm install --omit=dev
```

```text

up to date, audited 1 package in 255ms

found 0 vulnerabilities
```

That reads `1 package`, not `179`, because the single package is the project
itself and it has no runtime dependencies to add to it. Captured on a fresh
clone, that command created no `node_modules/` directory at all.

Run it only on a tree where you have not already installed the toolchain: on a
tree where you have, `--omit=dev` prunes the toolchain back out again. The
read-only equivalent is safe to run anywhere:

```bash
npm ls --omit=dev --depth=0
```

```text
hello_world@1.0.0 /path/to/hao-backprop-test
└── (empty)
```

The absolute path on the first line is machine-specific, so
`/path/to/hao-backprop-test` stands in for your own repository root; everything
else in that transcript is verbatim. The `(empty)` underneath is the entire
runtime dependency tree.

### Why the runtime needs nothing

Three independent checks agree, and none of them asks you to take this on
trust:

1. **The manifest declares no runtime dependencies.** `package.json` has no
   `dependencies` block at all — only a `devDependencies` block holding three
   entries. `Source: package.json`
2. **Every entry in the lockfile is a development entry.**
   `package-lock.json` is `lockfileVersion: 3` and holds 179 `packages`
   entries: the root package plus 178 dependencies, and all 178 carry
   `"dev": true`. There are zero non-development entries.
   `Source: package-lock.json`
3. **The service runs with no `node_modules/` directory present at all.**
   Verified by running `node server.js` in a directory containing only
   `server.js`, `package.json` and `package-lock.json`: the startup banner
   printed and a request came back `200`.

The cause is one line of source. The module's only import is Node's built-in
`http` module, which ships inside the runtime rather than being fetched from a
registry, so there is nothing for a package manager to resolve.
`Source: server.js:L1`

### What an install does fetch

Everything `npm install` brought in is documentation tooling. Three packages
are declared and the remaining 175 are their transitive tree:

| Package | Version | What it does |
| --- | --- | --- |
| `jsdoc` | `4.0.5` | Renders the JSDoc annotations in `server.js` into the generated HTML reference |
| `markdownlint-cli2` | `0.23.2` | Lints this documentation corpus, behind `npm run docs:lint` |
| `markdown-link-check` | `3.15.0` | Backs the link-integrity gate, behind `npm run docs:links` |

`Source: package.json`

None of the three enters the runtime path. `server.js` imports nothing but core
`http` before the install and nothing but core `http` after it, so installing
the toolchain cannot change how the service behaves.
`Source: server.js:L1`

Install only if you intend to build or lint the documentation. If you only want
to run the service, skip this section entirely — `node server.js` works on a
fresh clone. For a reproducible install driven by the lockfile alone, which is
what an automated pipeline should use, run `npm ci` in place of `npm install`:
it installs exactly what `package-lock.json` pins and refuses to proceed if the
lockfile and the manifest have drifted apart.

## Running the server

`node server.js` is the canonical command:

```bash
node server.js
```

```text
Server running at http://127.0.0.1:3000/
```

Exactly one line, and seeing it means the listener is accepting connections.
It is emitted by the *startup callback*, which runs once the socket is bound,
and its text is interpolated from the `hostname` and `port` constants rather
than written out literally — which is why the address in the banner always
matches the address actually bound. `Source: server.js:L12-L14`

`npm start` is equivalent and needs no extra setup:

```bash
npm start
```

```text

> hello_world@1.0.0 start
> node server.js

Server running at http://127.0.0.1:3000/
```

The two extra lines are npm echoing the script it is about to run, and the
banner underneath is identical because the process underneath is identical. The
resolution is explicit rather than implied: `package.json` declares
`scripts.start` as `node server.js`, so the npm route and the direct route are
the same command by definition. `Source: package.json`

Both forms run in the **foreground** and hold the terminal for as long as the
server is up, so the shell prompt does not come back. Run the verification step
below from a second terminal.

Neither form reads configuration from the environment. The address and port are
constants in the source and the module never touches `process.env`, so
`PORT=8080 npm start` still binds `127.0.0.1:3000`.
`Source: server.js:L3`, `Source: server.js:L4`

Changing either value means editing the constant and restarting the process;
[configuration.md](configuration.md) owns those two options in full.

## Verifying the install

With the server running, from a second terminal:

```bash
curl -i http://127.0.0.1:3000/
```

```http
HTTP/1.1 200 OK
Content-Type: text/plain
Date: Tue, 04 Aug 2026 17:40:56 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 14

Hello, World!
```

Five headers arrive and four of them are contract. `Date` is a per-request
volatile value that Node supplies automatically, so it advances with the clock
and will not match the transcript above; the stable contract is
`Content-Type: text/plain`, `Content-Length: 14`, `Connection: keep-alive`,
`Keep-Alive: timeout=5`, and the body `Hello, World!` followed by a newline —
14 bytes in total.

A `200` carrying that 14-byte `text/plain` body is a successful install. The
response is composed by three calls inside the *request listener*: the status
code is assigned first (`Source: server.js:L7`), then the `Content-Type`
header (`Source: server.js:L8`), and finally the body is written and the
response terminated (`Source: server.js:L9`).

One request is enough to verify an install, so only one appears here. The full
contract — which methods and paths match, why every one of them produces the
same *catch-all response*, and the worked examples that establish it — is owned
by [../api/http-api.md](../api/http-api.md).

The service answers on `127.0.0.1` only, so `curl` has to run on the same
machine as the server; [../guides/deployment.md](../guides/deployment.md) owns
that *loopback binding* constraint and what can be done about it.

## Stopping the server

Press `Ctrl+C` in the terminal that is running it.

That is an immediate termination rather than a drain. `server.listen` is handed
a *startup callback* and nothing else — no signal handler is registered and no
shutdown path exists anywhere in the module — so a request still in flight is
dropped instead of being allowed to finish, and no cleanup runs.
`Source: server.js:L12-L14`

Nothing needs undoing afterwards. The process holds no lock file and writes no
state to disk, and the TCP port is released as it exits, so the next
`node server.js` binds cleanly.

## When your Node.js is older than the floor

Nothing stops you. npm ships with `engine-strict` set to `false`, so an
`engines` mismatch is reported as a warning during install and the install then
proceeds; it is not a gate. On top of that, `server.js` happens to use no syntax
or API newer than the floor, so an older runtime may well appear to work.

Treat `>=18` as a support statement rather than as a guard, then. Below it you
are outside what is declared and outside what was verified, so nothing on this
page is guaranteed to reproduce, and a difference you hit there is yours to
diagnose alone. Upgrade with whichever version manager you already use, then
re-run `node --version` and compare the result against the floor before relying
on any behaviour documented here.

The `docs:*` scripts hold the separate, higher floor named in Prerequisites,
and they enforce it differently on purpose. `devEngines.runtime` declares
`>=22.12.0` for the documentation toolchain, because `markdownlint-cli2` and
the link checker's own dependencies need a newer runtime than the service does.
`Source: package.json` Every `docs:*` script runs a preflight check before
anything else, and that check fails closed rather than warning and continuing,
so a documentation build reports the reason instead of emitting broken output:

```bash
npm run docs:preflight
```

```text
documentation toolchain runtime check: node v22.23.2 satisfies devEngines.runtime ">=22.12.0"
```

The two floors never collide. `>=18` governs running the service and
`>=22.12.0` governs building the documentation, and a runtime that satisfies
only the first still runs `node server.js` and `npm start` correctly — it just
cannot lint or generate the docs.

Failures that are not version-related — a port already in use, or an
`npm test` that exits non-zero by design — are covered by
[../guides/troubleshooting.md](../guides/troubleshooting.md).

## See also

The corpus reading order continues from here, so the first three links below are
the next steps rather than a flat index.

- [../api/http-api.md](../api/http-api.md) — the full HTTP contract behind the
  request you just verified, including the *catch-all response* behaviour.
- [../architecture/code-walkthrough.md](../architecture/code-walkthrough.md) —
  all 14 lines of `server.js`, read one at a time.
- [../guides/deployment.md](../guides/deployment.md) — owner of the *loopback
  binding* constraint, plus reverse-proxy fronting and process supervision.
- [configuration.md](configuration.md) — the two hardcoded configuration
  constants and how to change them.
- [../guides/troubleshooting.md](../guides/troubleshooting.md) — owner of
  remediation for `EADDRINUSE` and the other operational symptoms.
- [../README.md](../README.md) — the documentation index, the glossary of the
  four fixed terms, and which page owns which fact.
- [../../README.md](../../README.md) — the canonical project overview, whose
  Prerequisites and Installation sections this page expands.
