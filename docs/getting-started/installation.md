# Installation

This page takes a machine that already has Node.js on it to a running service
that answers a request. It is the **owning document for the runtime baseline**:
every other page in the corpus cites the floor and the verified versions below
rather than declaring its own. Its facts about the application and its
dependencies come from three files — `server.js` for what the runtime actually
needs, `package.json` for the declared floors and the scripts, and
`package-lock.json` for what an install resolves. The documentation-toolchain
behaviour described at the end of the page has two further sources: the `docs:*`
scripts in `package.json` and `tools/check-doc-runtime.js`, the preflight those
scripts run.

**How to read the transcripts.** Every command that is followed by an output
block was executed on the baseline named below, and that block is the literal
output it produced. Two things on this page are deliberately *not* literal, and
both are labelled where they appear rather than only here: the clone command,
which has no single true URL and is presented as a template, and one
machine-specific path inside an `npm ls` header. Nothing else is reconstructed,
abridged, or paraphrased. Any command shown without a transcript beneath it is a
template rather than a captured run, and it is labelled as such where it appears.

## Prerequisites

Two kinds of prerequisite are involved, and conflating them is what makes setup
instructions confusing: what *running the service* needs, and what *completing
this page's workflow* needs. The table below separates them in its "Needed for"
column.

Running the service needs **Node.js and nothing else** — no compiler, no
database, no container runtime. Completing the workflow on this page needs two
more programs, and they are listed rather than assumed because a minimal
container image or a fresh Windows install may have neither:

| Program | Needed for | Check it with |
| --- | --- | --- |
| Node.js | Running the service, and every step here | `node --version` |
| npm | `npm start` and every `npm run` script; ships with Node.js | `npm --version` |
| Git | Obtaining the repository, once | `git --version` |
| curl | The verification request — **optional**, because a Node-only alternative is given in [Verifying the install](#verifying-the-install) | `curl --version` |

The versions those checks must satisfy, and the versions this page was verified
against:

| Item | Documented floor | Verified version |
| --- | --- | --- |
| Node.js — running the service | `>=18`, declared as `engines.node` | `v22.23.2` |
| npm | none declared; it ships with Node.js | `11.18.0` |
| Node.js — building the documentation | `>=22.12.0`, declared as `devEngines.runtime` | `v22.23.2` |
| Node.js — security requirement | a line still receiving security patches: Active LTS or Maintenance LTS | `v22.23.2` (Maintenance LTS) |

The two documented floors come from `Source: package.json` — `engines.node` and
`devEngines.runtime` respectively. The verified versions are not declared
anywhere: they are observations of the environment this page was written
against, captured by the `node --version` and `npm --version` runs reproduced
under [Verifying your toolchain](#verifying-your-toolchain) below.

### Acquisition prerequisites — what obtaining the repository needs

**Git, once.** It is not a runtime prerequisite: the service never invokes it,
no script in `package.json` calls it, and a tree obtained any other way — an
archive, a copy from another machine, a mounted volume — runs identically
without Git installed at all. Skip this row if you already have the files.

| Item | Documented floor | Verified version |
| --- | --- | --- |
| Git — cloning the repository only | none declared anywhere in the repository | `git version 2.51.0` |

### Why the runtime floors are what they are

Three of those rows ask three different questions about Node.js, and the
manifest answers only two of them. `engines.node` says what the code needs in
order to parse and run; `devEngines.runtime` says what the documentation tooling
needs; **neither says anything about whether the line you chose is still being
patched**, which is why the third requirement is stated here rather than
declared there. The next two subsections take the two kinds of requirement in
turn, because a version can satisfy every floor this repository declares and
still be an unsupported runtime.

No floor is declared for Git or curl. Any version of either that is currently
supported by its own project will do, because this page uses only their oldest,
most basic behaviour: one `git clone`, and one plain `GET`.

### What the declared floors mean

The floor for running the service sits at `>=18` because Node 18 already covers
the entire core `http` API surface the module touches — `require('http')`,
`http.createServer`, `server.listen`, `res.statusCode`, `res.setHeader` and
`res.end` — and the module reaches for nothing beyond it, so no newer line is
required and the floor is not raised past 18.
`Source: server.js:L1`, `Source: server.js:L6-L10`,
`Source: server.js:L12-L14`

**That is a functional statement and nothing more.** It says the module's code
parses and runs on Node 18 or newer. It is not a recommendation to run Node 18,
and it carries no security meaning at all — which runtime to actually choose is
[the next subsection](#which-nodejs-line-to-run), and the two answers differ.

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

### Which Node.js line to run

**Run a Node.js line that is still receiving security patches.** Satisfying
`engines.node` is necessary and it is not sufficient. Only the Active LTS and
Maintenance LTS lines are patched; once a line reaches end-of-life the project
ships nothing further for it, so a vulnerability disclosed against it afterwards
is never fixed upstream. The Node.js project's own guidance is that production
applications use Active LTS or Maintenance LTS releases only.

Support status as published in the official Node.js release schedule
(`nodejs.org/en/about/previous-releases`), read on 2026-08-04:

| Node.js line | Status | Support ends | Satisfies `>=18`? |
| --- | --- | --- | --- |
| 26 | Current; scheduled to become Active LTS on 2026-10-28 | 2029-04-30 as scheduled | Yes |
| 24 "Krypton" | **Active LTS** | 2028-04-30 | Yes |
| 22 "Jod" | **Maintenance LTS** — the line every transcript on this page was captured on | 2027-04-30 | Yes |
| 20 "Iron" | **End-of-life.** Final release `20.20.2` on 2026-03-24; the line reached its end-of-life milestone on 2026-04-30 | Already ended | Yes — and that is exactly the problem |
| 18 "Hydrogen" | **End-of-life.** Final release `18.20.8` on 2025-03-27; the line reached its end-of-life milestone on 2025-04-30 | Already ended | Yes — and that is exactly the problem |
| 16 and older | End-of-life | Already ended | No |
| Every odd-numbered line up to 25 | End-of-life; odd lines never entered LTS | Already ended | 19 and newer: yes |

Read the last column together with the second. **Node 18 and Node 20 satisfy
the declared floor and are unsupported runtimes**, so `engines.node` cannot be
used as a runtime-selection policy on its own — this repository's floor was
chosen to describe what the code needs, and it was never a claim about patch
status.

The consequence is a requirement, not a preference. Running this service on an
end-of-life line is **not acceptable for security-sensitive use and not
acceptable for any run reachable from a network**, including the reverse-proxy
arrangement in [../guides/deployment.md](../guides/deployment.md): a proxy in
front changes nothing about an unpatched runtime behind it. A local,
loopback-only, throwaway run on an end-of-life line is a risk you may knowingly
accept for yourself, and it is never a default this page recommends.

Two practical points:

- **Choose 22 or 24 today**, or 26 if you want the Current line and accept its
  faster cadence. Every command on this page was verified on `v22.23.2`.
- **Re-check the schedule instead of trusting the table above forever.** Support
  windows follow a published calendar, so a line that is Maintenance LTS as this
  is written becomes end-of-life on a date already known. The release schedule
  named above is the authority, and `node --version` compared against it is the
  whole check.

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
and that is expected.

Check the major version against **both** requirements, because they are not the
same test:

- **The declared floor.** Node 18, 20, 22, 24 and 26 all satisfy `>=18`; Node 16
  and anything older does not.
- **Still receiving security patches.** Only 22, 24 and 26 qualify as this is
  written. Node 18 and Node 20 clear the floor and are end-of-life, so seeing
  `v18.20.8` or `v20.20.2` here means the floor passed and the security
  requirement failed. [Which Node.js line to run](#which-nodejs-line-to-run) has
  the dates and what to do about it.

If either command reports that it is not found, Node.js is not installed or is
not on your `PATH`. Install it before going further; nothing below will work
without it.

Then check the two supporting programs. Git is needed once, to clone; curl is
needed only for the verification request, and the Node-only alternative in
[Verifying without curl](#verifying-without-curl) replaces it entirely:

```bash
git --version
curl --version
```

Captured output — abridged to the first line of each, because `curl --version`
prints a second line of build metadata that varies with every distribution
package:

```text
git version 2.51.0
curl 8.14.1 (x86_64-pc-linux-gnu) libcurl/8.14.1 OpenSSL/3.5.3 zlib/1.3.1 brotli/1.1.0 zstd/1.5.7 libidn2/2.3.8 libpsl/0.21.2 libssh2/1.11.1 nghttp2/1.64.0 librtmp/2.3 OpenLDAP/2.6.10
```

Those version strings do not have to match anything; only their presence
matters. On Linux and macOS this reports presence without printing versions at
all, and it is the check to use in a script:

```bash
for t in git curl; do command -v "$t" >/dev/null 2>&1 && echo "$t: present" || echo "$t: not installed"; done
```

```text
git: present
curl: present
```

That loop is POSIX shell. In PowerShell the equivalent is
`Get-Command git, curl`, and in Windows `cmd` it is `where git` and
`where curl`; both were not executed here, because this page was verified on
Linux.

## Obtaining the repository

Clone the repository and change into it. **This block is a template**, because
the clone URL depends on the host you are cloning from; it is the one command on
this page that was not executed, and there is no single true transcript for it
to show. Paste your own remote into the first line and the rest works as
written:

```bash
REPOSITORY_URL="paste your clone URL here"
git clone -- "$REPOSITORY_URL" hao-backprop-test
cd hao-backprop-test
```

Four details make that template safe to copy rather than merely illustrative,
and the first two are separate protections that are easy to conflate.

- **The URL is quoted**, so a value containing whitespace or a character the
  shell would otherwise act on — a space, a `;`, a `$`, a backtick — reaches Git
  as one intact argument instead of being split or expanded.
- **`--` ends option parsing**, which quoting cannot do. Quoting controls what
  the *shell* does with the value; it has no effect on how *Git* classifies the
  argument it receives. A value that begins with `-` is still read as an option,
  so `--upload-pack=…` or a similar leading-dash value pasted into
  `REPOSITORY_URL` would be interpreted as an instruction to Git rather than as
  a location to clone from (CWE-88). Git's own usage line — `git clone -h` on
  `git version 2.51.0` prints `git clone [<options>] [--] <repo> [<dir>]` —
  documents `--` as the separator that guarantees the next word is the
  repository.
- **The destination directory is named explicitly** — `hao-backprop-test` — so
  the following `cd` always matches, whatever the remote would have called it.
- **The template parses**, unlike a bare `git clone <repository-url>`: `<` and
  `>` are redirection operators, so the placeholder form is rejected by the shell
  before Git ever runs. `bash -n` confirms it — the template above passes, and
  the angle-bracket form exits 2 with
  `syntax error near unexpected token 'newline'`.

Neither of those first two protections makes an arbitrary URL safe to clone.
`--` stops a value being read as an option and quoting stops the shell rewriting
it, but cloning still contacts a remote host, fetches its objects and writes
files into your working tree. **Paste only an origin you trust**, over HTTPS or
SSH, from a host you recognise — for this repository, the URL your own Git host
shows on its clone button.

Confirm you landed in the right directory by listing it. `ls -1` is POSIX, so it
works on Linux and macOS; the PowerShell equivalent is `Get-ChildItem -Name`,
and the Windows `cmd` equivalent is `dir /b`:

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
`.markdown-link-check.json`. That transcript is a **freshly cloned** tree, taken
before the install step below; run the same command afterwards and a
`node_modules` entry joins the list.

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

Captured output, with **one substitution, marked in the transcript itself**: the
absolute path on the first line is machine-specific, so `<your repository root>`
stands where the captured run printed this clone's own path. Every other
character below is verbatim:

```text
hello_world@1.0.0 <your repository root>
└── (empty)
```

**This is the one transcript on the page that is not reproduced verbatim, and
this is the edit.** `npm ls` prints the absolute path of the repository root on
its first line, which is specific to the machine that ran it and would be wrong
for every reader; `<your repository root>` is substituted for it. Nothing
else was changed: the `hello_world@1.0.0` package identity and the `(empty)`
line beneath are exactly as captured, and that `(empty)` is the entire runtime
dependency tree. On your machine the first line will read `hello_world@1.0.0`
followed by wherever you cloned the repository.

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
fresh clone.

### The lockfile-driven alternative: `npm ci`

For an install driven by the lockfile alone, which is what an automated pipeline
should use, run `npm ci` in place of `npm install`:

```bash
npm ci
```

```text

added 178 packages, and audited 179 packages in 1s

77 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

Read it the way you read the two transcripts above. The package counts are
stable and the elapsed time is not, so `1s` is evidence of the shape of the
result rather than a figure to match. The funding line counts dependencies that
solicit funding and says nothing about whether the install succeeded; the audit
line reporting zero vulnerabilities is the one worth reading.

The difference from `npm install` only becomes visible on a second run. Because
`npm ci` deletes `node_modules/` and rebuilds it from the lockfile every time, it
reports `added 178 packages` on every run — the transcript above is itself from
a repeat run, and the first run printed the same lines. `npm install` on a tree
that is already installed reports `up to date` instead, as shown earlier.

That rebuild is also why `npm ci` installs exactly what `package-lock.json` pins
and refuses to run at all if the lockfile and the manifest have drifted apart —
the property that makes it the right choice for automation and an awkward one in
the middle of an edit.

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
constants in the source and the module never touches `process.env`, so setting
`PORT` changes nothing — the listener still binds `127.0.0.1:3000`.
`Source: server.js:L3`, `Source: server.js:L4` The inline form below is POSIX
shell syntax, so it works on Linux and macOS:

```bash
PORT=8080 npm start
```

Windows shells set a variable as a separate statement rather than as a command
prefix, so the equivalents there are `$env:PORT=8080; npm start` in PowerShell
and `set PORT=8080 && npm start` in `cmd`. All three end the same way: the
banner reads `http://127.0.0.1:3000/`, because nothing in the module ever looks
the variable up.

Changing either value means editing the constant and restarting the process;
[configuration.md](configuration.md) owns those two options in full.

## Verifying the install

With the server running, from a second terminal:

```bash
curl --noproxy '*' --include --silent --show-error --max-time 5 http://127.0.0.1:3000/
```

```http
HTTP/1.1 200 OK
Content-Type: text/plain
Date: Tue, 04 Aug 2026 21:41:17 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 14

Hello, World!
```

Every flag on that line is there to keep the check honest, and `--noproxy` is
the one that matters most:

| Flag | Why it is not optional |
| --- | --- |
| `--noproxy '*'` | Stops `curl` honouring `http_proxy`, `https_proxy` and `all_proxy` from the environment. Without it, a machine with a proxy configured sends this request to the proxy, and a `200` from the proxy — or its `403`, or its cached body — is indistinguishable here from a `200` from your server. The verification then proves nothing about the install |
| `--max-time 5` | Bounds the probe, so a filtered address fails instead of hanging |
| `--show-error` | Keeps the diagnostic visible even though `--silent` suppressed the progress meter |
| `--include` | Prints the status line and headers, which are what the next paragraph checks |
| `--silent` | Removes the progress meter, so the transcript is only the response |

Five headers arrive, and they do not all carry the same weight. Only
`Content-Type: text/plain` is written by the module, alongside the `200` status
and the body `Hello, World!` followed by a newline — 14 bytes in total. Those
three values are the contract, they come straight from the source, and they are
what you are checking for here.

The other four headers are Node's, and they are the **observed defaults for the
HTTP/1.1 `curl` request shown above** rather than guarantees. `Content-Length`,
`Connection` and `Keep-Alive` are all framed by the runtime from the request and
its protocol version, so a different request can legitimately produce different
values or omit them entirely — an HTTP/1.0 request, for instance, receives no
`Content-Length` at all. `Date` is volatile: Node regenerates it per response,
so it tracks the clock and will not match the transcript above. The full set of
framing variations is owned by
[../api/http-api.md](../api/http-api.md).

A `200` carrying that 14-byte `text/plain` body is a successful install. The
response is composed by three calls inside the *request listener*: the status
code is assigned first (`Source: server.js:L7`), then the `Content-Type`
header (`Source: server.js:L8`), and finally the body is written and the
response terminated (`Source: server.js:L9`).

### Verifying without curl

`curl` is not part of Node.js, and plenty of machines do not have it — minimal
container images routinely omit it, and it is not guaranteed on Windows either.
This check uses only what you already installed to run the service, so it works
anywhere the service itself works:

```bash
node -e "require('http').get('http://127.0.0.1:3000/', res => { let body=''; res.on('data', c => body += c); res.on('end', () => { console.log('status', res.statusCode); console.log('content-type', res.headers['content-type']); console.log('bytes', Buffer.byteLength(body)); console.log('body', JSON.stringify(body)); }); }).on('error', e => { console.error('request failed:', e.message); process.exitCode = 1; });"
```

```text
status 200
content-type text/plain
bytes 14
body "Hello, World!\n"
```

That reports the same four facts the `curl` transcript shows, and it makes the
trailing newline visible: `JSON.stringify` prints it as `\n`, which is how the
14 bytes are made up — 13 characters of greeting plus one line feed. A failed
request prints `request failed:` with Node's reason and exits non-zero, so the
command is usable as a check rather than only as a demonstration.

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
a *startup callback* and nothing else. `Source: server.js:L12-L14` No signal
handler is registered and no shutdown path exists anywhere in the module.
`Source: server.js:L1-L14` So a request still in flight is dropped instead of
being allowed to finish, and no cleanup runs.

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

**Clearing the floor is not the same as being on a supported runtime, and this
section is about the floor only.** Node 18 and Node 20 both satisfy `>=18` and
both reached end-of-life, so an upgrade that stops at either one fixes the
declared-floor problem and leaves an unpatched runtime in place. Upgrade to a
line that is still receiving security patches — 22, 24 or 26 as this is written
— rather than to the oldest version that happens to satisfy the range.
[Which Node.js line to run](#which-nodejs-line-to-run) is the authority for that
choice, with the support dates and the reasoning.

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
