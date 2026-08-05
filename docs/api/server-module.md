# Server module reference

This page is the code-level API reference for `server.js`, and it owns the
inventory of that module's **seven documented symbols** for the whole
documentation corpus. It mirrors the JSDoc annotations in the source, so the
reference is readable in the repository with no build step and no installed
tooling.

It is the second of the two API references this corpus carries. The first,
[http-api.md](http-api.md), documents the service's externally observable HTTP
contract — what a client sends and what it receives. This page documents the
code behind that contract: the module, its constants, and the signatures of its
two callbacks.

Source files this page derives from: `server.js` in its entirety, plus
`jsdoc.json` and `package.json` for the regeneration section at the end.

## Module contract

The module's contract is the single most surprising thing about it, so it comes
before the symbol entries rather than after them.

| Property | Value |
| --- | --- |
| Module system | CommonJS |
| Module name in JSDoc | `server`, declared with `@module` — `Source: server.js:L1-L14` |
| Exports | **None.** There is no `module.exports` and no `exports.*` assignment anywhere in the file |
| Observable contract | A side effect at import time: evaluating the module initiates listening on `127.0.0.1:3000`, and the successful bind is signalled asynchronously by the *startup callback* — `Source: server.js:L12-L14` |
| Runtime dependencies | None. The only import is Node's built-in `http` module — `Source: server.js:L1` |
| Declared dependency tag | `@requires http` |

The absence of exports is a verified fact rather than an inference: the file
contains no `module.exports` statement and no `exports.*` assignment anywhere.
Its eleven executable lines are accounted for in full by the seven symbols
below, and not one of them assigns an export. `Source: server.js:L1-L14`

That inverts the usual expectation for a module. `require('./server.js')`
returns CommonJS's default, empty `module.exports` object, so nothing
meaningful can be read from it — but the call is not harmless. Evaluating the
file runs `server.listen()`, which **initiates** the bind.
`Source: server.js:L12`

**`require()` returning does not mean the server is ready.** `server.listen()`
is asynchronous: it starts the bind and returns immediately, and the socket
becomes ready afterwards, on a later turn of the event loop. Node signals that
moment by emitting the `listening` event, which is what invokes the *startup
callback* and prints the banner. `Source: server.js:L12-L14` Two rules follow,
and they matter to anything that automates a start:

- **Never infer readiness from `require()` (or `import`) returning.** At that
  instant the bind may still be in flight, so a request issued immediately
  afterwards can be refused.
- **Wait for the `listening` signal instead** — the banner on stdout is the
  observable form of it — or poll the port until it accepts a connection.
  What that signal does and does not prove is set out under
  [Callback: ServerStartupCallback](#callback-serverstartupcallback).

The same asynchrony applies to the failure path: a bind that cannot succeed
fails after `require()` has already returned, surfacing as an `error` event that
this module does not handle rather than as an exception the caller could catch.

**A reader who imports this file expecting an inert module will bind a port by
accident.** There is no exported factory to call, no `createServer`-style
function to invoke on demand, and no guard such as a `require.main` check that
would defer the bind. Importing *is* starting the server. Anything that needs
the module's behaviour must run it as a process — `node server.js` — rather
than require it.

The JSDoc layer is shaped by that same property. With no export to hang a
reference off, the module is documented as a module in its own right: the file
header declares `@module server`, which makes every symbol in the file a member
of it, and the two callback typedefs become inner members addressable as
`module:server~RequestHandler` and `module:server~ServerStartupCallback`. Those
are the namepaths the generator actually resolves, confirmed from its own
output. What this page documents, therefore, is a module and its members — not
an export surface, because there is none.

## Symbol inventory

Seven symbols carry documentation. All of them are module-internal; none is
exported. Each has its own entry below, in this order.

| # | Symbol | Kind | Source | Documented with |
| --- | --- | --- | --- | --- |
| 1 | `server` module | CommonJS module | `Source: server.js:L1-L14` | `@file`, `@module`, `@description`, `@requires`, `@author`, `@license`, `@since`, `@example`, `@see` |
| 2 | `http` | Constant, require binding | `Source: server.js:L1` | `@constant`, `@type`, `@requires`, `@see` |
| 3 | `hostname` | Constant, string | `Source: server.js:L3` | `@constant`, `@default` |
| 4 | `port` | Constant, number | `Source: server.js:L4` | `@constant`, `@default` |
| 5 | `server` | Constant, `http.Server` | `Source: server.js:L6` | `@constant`, `@type`, `@see` |
| 6 | `RequestHandler` | Callback typedef | `Source: server.js:L6-L10` | `@callback`, `@param`, `@returns`, `@listens`, `@example` |
| 7 | `ServerStartupCallback` | Callback typedef | `Source: server.js:L12-L14` | `@callback`, `@returns`, `@listens`, `@example` |

Type annotations use the canonical Node.js class names — `http.Server`,
`http.IncomingMessage`, and `http.ServerResponse` — never an alias and never a
shortened form. Using the canonical names is what keeps this reference linkable
to Node's own documentation.

Symbols 1 and 5 share the name `server` without colliding. Number 1 is the
JSDoc module name declared in the file header; number 5 is a constant declared
inside it. JSDoc distinguishes them by namepath: the module is `module:server`
and the constant is a member of it.

## Module: server

| Field | Value |
| --- | --- |
| Kind | CommonJS module |
| JSDoc name | `server`, declared `@module server` |
| Namepath | `module:server` |
| Requires | `http`, declared `@requires http` |
| Exports | None |
| Source | `Source: server.js:L1-L14` |

The whole application: 14 content lines — 11 lines of code and 3 blank
separators at L2, L5, and L11 — with no framework, no router, and no runtime
dependencies. `Source: server.js:L1-L14`

The file header declares the module with `@module server`. That tag marks the
file as its own module and makes every symbol in it a member, which is what
gives the constants and typedefs below their namepaths.

The declaration also makes the module referenceable. Because JSDoc addresses
modules through a `module:` prefix, `{@link module:server}` resolves to this
module from anywhere in the annotation layer, and its members resolve as
`module:server~RequestHandler` and `module:server~ServerStartupCallback`. The
source uses exactly those two namepaths to link the `http.createServer` and
`server.listen` documentation to the callback typedefs that describe their
arguments. Written without the prefix the references would not resolve, and the
generated reference would carry two dead links instead of two working ones.

Beyond the module name, the header carries `@description` for the module-level
narrative, `@requires http` for the single dependency, `@author`, `@license`,
and `@since` for provenance, an `@example` showing the process being started,
and `@see` pointing at Node's `http` documentation.

## Constant: http

| Field | Value |
| --- | --- |
| Kind | Constant, require binding |
| Type | `module:http` |
| Declaration | `const http = require('http');` |
| Source | `Source: server.js:L1` |

Node's built-in HTTP module, and this module's only dependency. It is the
namespace that supplies `http.createServer()` at L6, and the classes named
throughout this page — `http.Server`, `http.IncomingMessage`, and
`http.ServerResponse` — belong to it. `Source: server.js:L1`

`http` is a **core** module: it ships bundled with the Node.js runtime. It
therefore needs **no `npm install`**, appears in no dependency manifest, and
cannot be missing from a working Node installation. Readers routinely assume
otherwise and go looking for the package that provides it; there is none to
find. This is also why the application has a genuinely empty runtime dependency
tree, and why `npm install` in this repository resolves only the optional
documentation toolchain.

## Constant: hostname

| Field | Value |
| --- | --- |
| Kind | Constant, string |
| Type | `string` |
| Default | `'127.0.0.1'` |
| Source | `Source: server.js:L3` |

The IPv4 loopback address the listener binds. It is passed to `server.listen()`
as the second argument, `Source: server.js:L12`, and interpolated into the
readiness banner one line later, `Source: server.js:L13`.

Binding the loopback literal rather than a wildcard address is the *loopback
binding*, and its consequence — that no other machine can reach the service at
all — is owned and analysed in
[../guides/deployment.md](../guides/deployment.md), which also covers fronting
the service with a reverse proxy. The option itself, including how to change it,
is documented in
[../getting-started/configuration.md](../getting-started/configuration.md).

There is no environment-variable override. The value is a hard-coded source
literal, so changing it means editing the line and restarting the process.
`Source: server.js:L3`

## Constant: port

| Field | Value |
| --- | --- |
| Kind | Constant, number |
| Type | `number` |
| Default | `3000` |
| Source | `Source: server.js:L4` |

The TCP port the listener binds. It is passed to `server.listen()` as the first
argument, `Source: server.js:L12`, and interpolated into the readiness banner
one line later, `Source: server.js:L13`.

The port must be free when the process starts. A conflict is the module's one
routine startup failure: the bind fails with `EADDRINUSE`, and because the file
installs no `error` listener that surfaces as an unhandled event, so the
process exits without ever printing the banner. Remediation is owned by
[../guides/troubleshooting.md](../guides/troubleshooting.md).

As with `hostname` there is no environment-variable override.
`Source: server.js:L4`

## Constant: server

| Field | Value |
| --- | --- |
| Kind | Constant, object instance |
| Type | `http.Server` |
| Produced by | `http.createServer([options][, requestListener])` |
| Source | `Source: server.js:L6` |

The HTTP server instance, produced by the factory whose canonical signature is
`http.createServer([options][, requestListener])`. Both parameters are optional.
Exactly one argument is supplied here and it is a function, so it is taken as
the `requestListener`; no options object is passed at all, which is why the
instance runs entirely on Node's defaults. `Source: server.js:L6`

The listener supplied is the *request listener*, whose signature is documented
as `RequestHandler` below. Node registers it for the server's `request` event,
so it runs once per request that Node dispatches through that event — which is
not the same as once per inbound connection or once per byte sequence a client
sends. A `CONNECT` goes to the `connect` event instead, and a request carrying
an unsupported `Expect` header is answered by Node before the listener is
consulted; neither reaches this function, and a request Node's parser rejects is
answered by the runtime before any dispatch happens at all.
`Source: server.js:L6` Those cases are enumerated in
[http-api.md](http-api.md), which owns the HTTP contract.

Construction alone does **not** open a socket. The instance stays idle until
`server.listen()` is called, which is where the port is actually bound and where
the *startup callback* is supplied. `Source: server.js:L12`

Application code registers exactly two functions on this instance: the one
*request listener* passed to `http.createServer()` at `Source: server.js:L6`,
and the *startup callback* passed to `server.listen()` at
`Source: server.js:L12`, which Node registers as a one-shot `listening`
listener. Nothing else is attached — no `error` handler, no `close` handler, no
`connect`, `upgrade`, `checkContinue`, `checkExpectation` or `clientError`
handler, no timeout override, and no second listener on any of those events. Its
behaviour is therefore exactly Node's default behaviour, which is what makes the
failure mode described under `port` above an unhandled event rather than a
handled one.

## Callback: RequestHandler

The signature of the *request listener* — the anonymous arrow function
registered on the server. `Source: server.js:L6-L10`

| Field | Value |
| --- | --- |
| Kind | `@callback` typedef |
| Namepath | `module:server~RequestHandler` |
| Listens to | `http.Server#event:request` |
| Invoked | Once per request Node dispatches through the server's `request` event |
| Returns | `void` |
| Source | `Source: server.js:L6-L10` |

### Parameters

| Parameter | Type | Notes |
| --- | --- | --- |
| `req` | `http.IncomingMessage` | The inbound request. **Never read by application logic.** No property of it is inspected anywhere in the handler — not `method`, not `url`, not `headers` — and the body stream is never read here either. The runtime still receives an unread body and discards it after the reply finishes |
| `res` | `http.ServerResponse` | The outbound response stream the reply is composed on. Mutated in place |

The `req` parameter is documented as received-but-unread rather than as an input
to any logic, and that is a verified property of the source rather than a
simplification: the handler body contains no read of `req` at all.
`Source: server.js:L6-L10`

"Unread" is scoped to application code on purpose. It does not mean the request
body never arrives: Node receives it, buffers it, and throws away whatever the
application left unread once the response has finished, so an ignored upload still
costs bandwidth and still holds its connection open while it arrives. The measured
demonstration is owned by
[http-api.md](http-api.md#what-happens-to-a-body-nobody-reads).

That single omission is what produces the *catch-all response*. With nothing
read from the request, no code exists that could branch on a method, a path, a
query string, a header, or a body, so there is no routing and no method
discrimination to document for the requests this handler receives.

That last qualifier is deliberate. It is the handler that treats every request
alike; it is not true that every request a client sends is treated alike,
because Node decides what becomes a `request` event before this function is
reached — a `CONNECT` never arrives here, an unsupported `Expect` header is
refused by Node itself, and a `HEAD` reply has its body discarded beneath the
handler. The full list, with captured evidence, is owned by
[http-api.md](http-api.md).

The invariance that follows is the *application's*, and it reaches exactly as
far as this handler does. Two requests never reach it — `CONNECT`, which Node
routes to the `connect` event, and anything Node's parser rejects — and for a
`HEAD` request Node discards the body this handler wrote before it reaches the
wire. The externally observable consequences of all three, and the headers Node
frames around the reply, are owned by
[http-api.md](http-api.md). `Source: server.js:L6-L10`

### Return value

`void`. The handler returns nothing, and a returned value would be ignored if it
did. The reply reaches the client purely as a side effect of writing to `res`.

### How the reply is composed

Three ordered statements, each on its own line:

| Order | Statement | Effect | Source |
| --- | --- | --- | --- |
| 1 | `res.statusCode = 200;` | Sets the status on the response object | `Source: server.js:L7` |
| 2 | `res.setHeader('Content-Type', 'text/plain');` | Declares the payload's media type | `Source: server.js:L8` |
| 3 | `res.end('Hello, World!\n');` | Writes the body and terminates the response, flushing the head implicitly | `Source: server.js:L9` |

The status is assigned through the individual `res.statusCode` **property**, and
the one header is applied through an individual `res.setHeader()` **call**. No
combined status-and-headers helper is used anywhere in the module. That detail
matters for anyone extending the handler: because the head is flushed
implicitly by `res.end()`, steps 1 and 2 must both precede step 3, and once
step 3 has run neither the status nor a header can be changed.

The values those three statements produce — the status code, the response
headers, the exact body, and worked `curl` transcripts — are owned by
[http-api.md](http-api.md) and are not restated here.

## Callback: ServerStartupCallback

The signature of the *startup callback* — the anonymous arrow function handed to
`server.listen()`. `Source: server.js:L12-L14`

| Field | Value |
| --- | --- |
| Kind | `@callback` typedef |
| Namepath | `module:server~ServerStartupCallback` |
| Listens to | `http.Server#event:listening` |
| Invoked | Exactly once, after the socket is bound successfully |
| Parameters | None |
| Returns | `void` |
| Side effect | Writes exactly one line to standard output |
| Source | `Source: server.js:L12-L14` |

Node invokes it once, after the socket has been bound and the server has begun
accepting connections. Its entire body is a single `console.log` call, and that
write to **stdout** is its only effect: it performs no health check, validates
nothing, queries no runtime state, and returns no value.
`Source: server.js:L13`

The line it writes is the readiness banner:

```text
Server running at http://127.0.0.1:3000/
```

The banner is produced by a template literal that interpolates the `hostname`
and `port` constants, so it always reports the values actually in force rather
than a second hardcoded copy of them. Change either constant and the banner
follows. `Source: server.js:L13`

### What the banner proves, and what it does not

The banner is a **one-way, one-time** signal, and treating it as anything more
is the most common mistake made with this module. It is written once, from
inside a callback that Node only invokes after the bind has succeeded, and it is
never written again.

| Observation | What it establishes |
| --- | --- |
| The banner appeared | The bind succeeded and the server began accepting connections **at that moment**. This is sound: the callback is unreachable unless the `listening` event fired — `Source: server.js:L12-L14` |
| The banner has not appeared | **Nothing conclusive.** The bind may still be in flight, since `server.listen()` is asynchronous; or stdout may have been redirected, discarded, or simply not observed by whoever is looking; or the process may indeed have failed to bind |
| The banner appeared earlier | Nothing about *now*. The process may have exited or been killed in the meantime, and no second line is ever written to say so |

The asymmetry has one cause: the banner reports an event, not a state. There is
no heartbeat, no shutdown message, and no `error` handler that would print a
failure — a failed bind produces an unhandled `error` event instead, which is
why a crash is visible as a stack trace on stderr rather than as a line from
this callback.

So use the banner for what it is — confirmation that a start succeeded — and use
an active check for anything else. Whether the service is listening *now* is
answered by looking for a live process, by opening a TCP connection to the port,
or by issuing an HTTP request and comparing the reply against the documented
contract. All three, and their limits, are covered by
[../guides/troubleshooting.md](../guides/troubleshooting.md).

## Why both callbacks are @callback typedefs

Symbols 6 and 7 are documented as typedefs while symbols 2 to 5 are documented
as constants. The asymmetry is not a stylistic preference, and it is the
question this page is most often read to answer.

Both functions are **anonymous inline arrow expressions**. Neither is assigned
to a variable, neither is a named function declaration, and neither exists
anywhere outside the argument list it is written in: one is passed straight into
`http.createServer()`, the other straight into `server.listen()`.
`Source: server.js:L6` `Source: server.js:L12`

An ordinary JSDoc block documents a *named* thing — it sits above a declaration
and binds to the identifier it finds there. With an anonymous expression there
is no identifier to bind to, so a plain block has nothing to attach itself to
and the function goes undocumented.

`@callback` typedefs are therefore **the required approach here**, and the
reason is a project constraint rather than a limit of JSDoc. JSDoc does offer
other ways to document a function that has no identifier of its own — an
explicit `@name`, an `@function` block with a supplied namepath, or a
`@type {function(...)}` annotation on a declaration the function is assigned to
— but each of those either invents a name that appears nowhere in the source or
requires the function to be given one, and giving these two functions a name
means editing an executable line. This work is comment-only, so the two
techniques that leave the eleven executable lines byte-identical are `@callback`
and `@typedef`, and `@callback` is the one the standard defines for exactly this
case. It is the standards-conformant choice, not the only mechanism that exists.

The technique is standards-based, not improvised. JSDoc's own `@callback`
reference defines the tag as describing a callback function's parameters and
return value, accepting any tag that is valid on a method, and — decisively —
making the callback's name usable as a type name in exactly the way `@typedef`
does. That last property is what the annotation layer relies on: once
`RequestHandler` and `ServerStartupCallback` exist as type names, the
documentation for `http.createServer()` and `server.listen()` can reference them
as the types of the arguments those calls receive, and the generator resolves
them as `module:server~RequestHandler` and
`module:server~ServerStartupCallback`.

| Symbol | Why not an ordinary doc block |
| --- | --- |
| `RequestHandler` | The function is written inline as the argument to `http.createServer()` and has no name — `Source: server.js:L6` |
| `ServerStartupCallback` | The function is written inline as the third argument to `server.listen()` and has no name — `Source: server.js:L12` |

There is an obvious alternative, and it is deliberately not taken. Converting
either arrow function into a named function — or even just assigning it to a
`const` — *would* give JSDoc an identifier to bind to and remove the need for a
typedef. Doing so is **explicitly out of scope**, because it would change an
executable statement, and the rule governing this work is that every source edit
is comment-only: the eleven executable lines of `server.js` are byte-identical
before and after the annotation layer was added. The typedefs exist precisely so
that no executable line has to change to make the module documentable.

## Line-number citation basis

Every `Lnn` citation on this page refers to the **original 14-content-line
layout** of `server.js` — 11 lines of code, with blank separators at L2, L5, and
L11. That numbering is the citation basis the entire documentation corpus
shares.

The JSDoc blocks and inline comments now in the file shift the physical line
numbers of the statements they describe, so a citation here will not match a
line number read off the annotated file. That is intentional: the citations are
anchored to the layout, not to the physical file, so they stay valid however
much the annotation layer grows. The mapping from citation line to symbol is in
[../architecture/code-walkthrough.md](../architecture/code-walkthrough.md),
which reads the same module line by line.

## Regenerating this reference from source comments

This page is **authored by hand**, and that is deliberate. It is readable in the
repository with no build step at all, so a reader who installs nothing still
gets the complete reference. The generator is **optional**: it renders the same
annotations mechanically, which is useful for spotting drift between this page
and the source, but nothing here depends on it having been run.

The generator is configured by `jsdoc.json` at the repository root, whose only
source input is `server.js`, and it is invoked through the `docs:api` script.

**Install the dev dependencies first.** `jsdoc` is a declared devDependency, so
on a freshly cloned tree with no `node_modules/` the script has no generator to
run and fails immediately. One install is enough, and
[../getting-started/installation.md](../getting-started/installation.md) owns
that step in full — including why the *runtime* needs nothing installed:

```bash
npm install
npm run docs:api
```

Use `npm ci` in place of `npm install` where you want the lockfile honoured
exactly. On a tree where the toolchain is already installed, run the second
command alone:

```bash
npm run docs:api
```

Skipping the install produces this, captured on a copy of the repository with no
`node_modules/` directory — the runtime preflight passes and the generator is
simply absent, and the script exits 127:

```text
> hello_world@1.0.0 docs:api
> node tools/check-doc-runtime.js && jsdoc -c jsdoc.json

documentation toolchain runtime check: node v22.23.2 satisfies devEngines.runtime ">=22.12.0"
sh: 1: jsdoc: not found
```

Captured output of that run:

```text
> hello_world@1.0.0 docs:api
> node tools/check-doc-runtime.js && jsdoc -c jsdoc.json

documentation toolchain runtime check: node v22.23.2 satisfies devEngines.runtime ">=22.12.0"
```

The generator itself prints nothing on success; the one line above comes from
the runtime preflight the script runs first. Output is written to
`docs/api/generated/`, which is **git-ignored and never committed**. No page in
this corpus links into that directory, because such a link would resolve only
for a reader who had just run the generator and would be broken for everyone
else — so the path is named in prose, as above, and never linked.

Two properties of the command are worth knowing. It doubles as a parse check,
because `jsdoc.json` sets `tags.allowUnknownTags` to `false`, so a mistyped tag
name fails the run instead of being silently dropped. And it reads the
annotations straight out of `server.js`, so it can only ever report what the
source actually says.

An **optional** second script, `docs:md`, renders the same annotations as
Markdown into the same git-ignored directory. It is a convenience for comparing
the generated text against this page when checking for drift, and nothing in
the corpus requires it: this page is authored and committed, and neither
documentation gate invokes the script.

### Where each generator comes from

The two generators are resolved differently, and that difference is a security
property rather than a packaging detail. Both are reproducible, and neither
downloads an unpinned closure of third-party code.

`docs:api` runs `jsdoc`, a devDependency of the root manifest resolved through the
root `package-lock.json`, so every package it loads is pinned to an exact version
and checked against a recorded integrity hash.

`docs:md` runs the same way, from its own manifest. The renderer is **not** a root
devDependency — it is optional tooling, so the root toolchain stays at three
required packages — but it is not resolved ad hoc either. It has a dedicated,
committed manifest and lockfile of its own:

```text
tools/docs-md/package.json        devDependencies: jsdoc-to-markdown 9.1.3
tools/docs-md/package-lock.json   lockfileVersion 3, 82 packages, all pinned
```

The script installs from that lockfile and then runs the local binary:

```bash
npm ci --ignore-scripts --prefix tools/docs-md
node tools/docs-md/node_modules/.bin/jsdoc2md --files server.js
```

Four properties follow, and together they are why the renderer is safe to invoke
from a trusted npm script at all:

- **The pin is deep, not shallow.** `npm ci` installs exactly what the committed
  lockfile names and nothing else: all 82 packages are pinned to an exact version,
  every one carries an integrity hash, and every one resolves to a
  `registry.npmjs.org` tarball. Two runs months apart execute the identical
  closure, which is what a bare `jsdoc-to-markdown@9.1.3` fetch could never
  promise — that pin fixes the top-level package only and leaves its transitive
  dependencies to be resolved fresh (CWE-494).
- **The one deliberately mutable range in the package is never resolved.**
  `jsdoc-to-markdown` declares `@75lb/nature: latest` as a peer dependency, and
  a `latest` range is by definition whatever the registry serves today. It is
  marked optional, so `npm ci` does not install it: the lockfile holds no entry
  for it, and nothing here resolves `latest` at any point.
- **Nothing executes during installation.** `--ignore-scripts` blocks lifecycle
  scripts, and the lockfile independently records that not one of the 82 packages
  declares an install script, so there is nothing for that flag to have to block.
  The generator itself still runs with the privileges of whoever invokes it — that
  is true of any local tool, including `jsdoc`.
- **It stays optional and out of every gate.** `docs:lint`, `docs:links` and
  `docs:check` never call it, and neither does `docs:api`. Nothing in the corpus
  depends on its output: this page is authored and committed, and the renderer
  exists only to compare a fresh rendering against it when checking for drift.

The install needs registry access or an npm cache that already contains every
locked tarball. Later runs can reuse that cache, but `npm ci` still removes and
rebuilds `tools/docs-md/node_modules`; the command does not promise to avoid every
registry check. If you would rather not install into the repository at all, run
the same two commands inside a container: the lockfile is what makes the result
identical either way.

## See also

- [../../README.md](../../README.md) — the canonical overview, whose API
  documentation section this page expands.
- [http-api.md](http-api.md) — the HTTP counterpart: the externally observable
  contract these symbols implement, and the owner of the status, headers, body,
  and worked `curl` examples.
- [../architecture/code-walkthrough.md](../architecture/code-walkthrough.md) —
  the line-granularity companion to this page, reading the same module line by
  line and mapping each citation line to the symbol that documents it.
- [../architecture/request-lifecycle.md](../architecture/request-lifecycle.md) —
  the three composition steps narrated in the context of one request.
- [../getting-started/configuration.md](../getting-started/configuration.md) —
  owner of the two configuration constants and how to change them.
- [../guides/deployment.md](../guides/deployment.md) — owner of the *loopback
  binding* constraint that the `hostname` constant creates.
- [../guides/troubleshooting.md](../guides/troubleshooting.md) — owner of
  port-conflict remediation and the other operational failure modes.
- [../README.md](../README.md) — the documentation index, and the glossary that
  fixes the terms used on this page.
- [../../CONTRIBUTING.md](../../CONTRIBUTING.md) — the JSDoc tag set in use, the
  `@callback` convention, and the rule that source edits stay comment-only.
