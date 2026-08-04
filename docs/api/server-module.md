# Server module reference

The code-level reference for `server.js`. This page owns the inventory of the
module's **seven documented symbols** for the whole documentation corpus, and it
mirrors the JSDoc annotations in the source so the reference is readable with no
build step.

Source files this page derives from: `server.js` in its entirety.

## Module contract

| Property | Value |
| --- | --- |
| Module system | CommonJS |
| Module name in JSDoc | `server`, declared with `@module` |
| Exports | **None.** There is no `module.exports` and no `exports.*` assignment anywhere in the file |
| Observable contract | A side effect at import time: evaluating the module binds a listening TCP socket |
| Runtime dependencies | None. The only import is Node's built-in `http` module, at `server.js:L1` |

The absence of exports deserves emphasis, because it inverts the usual
expectation for a module. `require('./server.js')` returns CommonJS's default,
empty `module.exports` object — nothing meaningful can be read from it — but the
call is not harmless: by the time it returns, `server.listen()` at
`server.js:L12` has already bound a socket. A reader who imports this file
expecting an inert module will bind a port by accident.

## Symbol inventory

Seven symbols carry documentation. All of them are module-internal; none is
exported.

| # | Symbol | Kind | Source | Documented with |
| --- | --- | --- | --- | --- |
| 1 | `server` module | CommonJS module | `server.js:L1-L14` | `@file`, `@module`, `@description`, `@requires`, `@author`, `@license`, `@since`, `@example`, `@see` |
| 2 | `http` | Constant, require binding | `server.js:L1` | `@constant`, `@type` |
| 3 | `hostname` | Constant, string | `server.js:L3` | `@constant`, `@type`, `@default` |
| 4 | `port` | Constant, number | `server.js:L4` | `@constant`, `@type`, `@default` |
| 5 | `server` | Constant, `http.Server` | `server.js:L6` | `@constant`, `@type`, `@see` |
| 6 | `RequestHandler` | Callback typedef | `server.js:L6-L10` | `@callback`, `@param`, `@returns`, `@listens`, `@example` |
| 7 | `ServerStartupCallback` | Callback typedef | `server.js:L12-L14` | `@callback`, `@returns`, `@listens`, `@example` |

Type annotations use the canonical Node.js class names — `http.Server`,
`http.IncomingMessage`, and `http.ServerResponse` — so the generated reference
links back to Node's own documentation rather than inventing aliases.

## Constant: http

| Field | Value |
| --- | --- |
| Type | `module:http` |
| Source | `server.js:L1` |
| Declaration | `const http = require('http');` |

Node's built-in HTTP module. Being a core module, it requires no installation and
appears in no dependency manifest, which is what lets the application keep a
genuinely empty runtime dependency tree.

## Constant: hostname

| Field | Value |
| --- | --- |
| Type | `string` |
| Default | `'127.0.0.1'` |
| Source | `server.js:L3` |

The IPv4 loopback address the listener binds. Its consequence — that no other
host can reach the service — is owned by
[../guides/deployment.md](../guides/deployment.md), and the option itself is
documented in
[../getting-started/configuration.md](../getting-started/configuration.md).

## Constant: port

| Field | Value |
| --- | --- |
| Type | `number` |
| Default | `3000` |
| Source | `server.js:L4` |

The TCP port the listener binds. A conflict here is the module's one routine
startup failure; see
[../guides/troubleshooting.md](../guides/troubleshooting.md).

## Constant: server

| Field | Value |
| --- | --- |
| Type | `http.Server` |
| Source | `server.js:L6` |

The server instance returned by `http.createServer()`, with the request listener
registered on it. Nothing else is attached: no `error` handler, no `close`
handler, and no timeout override, so the instance behaves exactly as Node's
defaults dictate.

## Callback: RequestHandler

The signature of the request listener at `server.js:L6-L10`.

| Field | Value |
| --- | --- |
| Kind | `@callback` typedef |
| Listens to | `http.Server#event:request` |
| Returns | `void` |

| Parameter | Type | Notes |
| --- | --- | --- |
| `req` | `http.IncomingMessage` | The inbound request. **Never read** — not `method`, not `url`, not `headers`, and the body stream is never consumed |
| `res` | `http.ServerResponse` | The outbound response stream. Mutated in place |

It is documented as a typedef rather than as a function for a concrete reason:
the listener is an anonymous inline arrow expression, so there is no identifier
for an ordinary doc block to attach to. `@callback` is the standards-sanctioned
way to give such a function a documented, referenceable name and to make that
name usable as a type.

The function returns nothing. The reply reaches the client purely as a side
effect of writing to `res`, in the three ordered steps described in
[http-api.md](http-api.md).

## Callback: ServerStartupCallback

The signature of the startup callback at `server.js:L12-L14`.

| Field | Value |
| --- | --- |
| Kind | `@callback` typedef |
| Listens to | `http.Server#event:listening` |
| Parameters | None |
| Returns | `void` |
| Side effect | Writes one line to standard output |

Also an anonymous inline arrow expression, and documented as a typedef for the
same reason. It runs once, after the socket is bound, and its only effect is the
readiness banner:

```text
Server running at http://127.0.0.1:3000/
```

The banner text is interpolated from the `hostname` and `port` constants at
`server.js:L13`, so it always reports the values actually in force rather than a
second hardcoded copy of them.

## Line-number citation basis

Every `Lnn` citation on this page refers to the **original 14-content-line
layout** of `server.js` — 11 lines of code and blank separators at L2, L5, and
L11. The JSDoc blocks and inline comments now in the file shift the physical line
numbers of those statements without changing the citation basis, which the whole
corpus shares. The mapping from citation line to physical position is in
[../architecture/code-walkthrough.md](../architecture/code-walkthrough.md).

## Regenerating this reference from source

This page is authored by hand, so it is readable in the repository with no build
step and cannot break when tooling is unavailable. Two commands render the same
annotations mechanically, which is useful for spotting drift:

```bash
npm run docs:api
npm run docs:md
```

The first writes an HTML reference, the second a Markdown one, both into
`docs/api/generated/`. That directory is git-ignored build output: it is never
committed, and no page in this corpus links into it. Both commands read the
annotations directly out of `server.js` using the JSDoc configuration in
`jsdoc.json`, and both fail loudly if an annotation stops parsing, because
`jsdoc.json` sets `tags.allowUnknownTags` to `false`.

## See also

- [http-api.md](http-api.md) — the HTTP contract these symbols implement.
- [../architecture/code-walkthrough.md](../architecture/code-walkthrough.md) —
  the same module read line by line.
- [../getting-started/configuration.md](../getting-started/configuration.md) —
  owner of the two configuration constants.
- [../../CONTRIBUTING.md](../../CONTRIBUTING.md) — the JSDoc tag set in use and
  the rule that source edits stay comment-only.
