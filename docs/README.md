# Documentation

This directory holds the depth behind the root
[README](../README.md). The README is deliberately self-sufficient — it is
enough on its own to install, run, call, and deploy the service — and every page
here expands one of its sections rather than replacing it.

Source files these pages derive from: `server.js`, `package.json`,
`package-lock.json`, `jsdoc.json`, and the six repository fixtures.

## Reading order for newcomers

Four pages, in this order, take you from an empty machine to a request and back:

1. [Installation](getting-started/installation.md) — prerequisites, install,
   run, verify, stop.
2. [HTTP API](api/http-api.md) — what the service answers, and why the path and
   the method make no difference.
3. [Code walkthrough](architecture/code-walkthrough.md) — all 14 lines of
   `server.js`, one at a time.
4. [Deployment](guides/deployment.md) — the loopback constraint first, then how
   to run the thing somewhere real.

## Page index

| Page | What it covers |
| --- | --- |
| [getting-started/installation.md](getting-started/installation.md) | Prerequisites and the verified runtime baseline, obtaining the repository, installing, running, verifying, stopping |
| [getting-started/configuration.md](getting-started/configuration.md) | The two hardcoded configuration constants, how to change them, and why no environment variable is read |
| [api/http-api.md](api/http-api.md) | The HTTP contract: request-matching matrix, status, headers, body, worked examples, transport limits |
| [api/server-module.md](api/server-module.md) | The code-level reference for all seven documented symbols, and how to regenerate it |
| [guides/deployment.md](guides/deployment.md) | Deployment model, the loopback constraint, reverse-proxy fronting, supervision, port conflicts, hardening gaps |
| [guides/troubleshooting.md](guides/troubleshooting.md) | Symptom-to-remedy matrix with a decision tree, including the failures that are intentional |
| [architecture/overview.md](architecture/overview.md) | Architectural style, component model, startup flow, lifecycle states, design rationale |
| [architecture/request-lifecycle.md](architecture/request-lifecycle.md) | One request from socket accept to response flush, step by step |
| [architecture/code-walkthrough.md](architecture/code-walkthrough.md) | Annotated line-by-line reading of `server.js`, with a line-to-symbol map |
| [repository-assets.md](repository-assets.md) | The six non-application fixtures, their verified properties, and the preservation policy |

Outside this directory: the root [README](../README.md) is the canonical
overview, [CONTRIBUTING.md](../CONTRIBUTING.md) covers authoring and validating
documentation, and [LICENSE](../LICENSE) carries the MIT text.

## Which page owns which fact

A fact that appears in more than one page is owned by exactly one of them, and
everywhere else links here rather than restating it. That is what keeps a future
correction landing in a single place.

| Fact | Owning page |
| --- | --- |
| Node.js runtime baseline | [getting-started/installation.md](getting-started/installation.md) |
| The two configuration constants | [getting-started/configuration.md](getting-started/configuration.md) |
| The HTTP response contract | [api/http-api.md](api/http-api.md) |
| The seven documented symbols | [api/server-module.md](api/server-module.md) |
| The loopback binding, and the constraint it creates | [guides/deployment.md](guides/deployment.md) |
| Fixture provenance | [repository-assets.md](repository-assets.md) |
| Component model diagram | [architecture/overview.md](architecture/overview.md) |
| Request lifecycle diagram | [api/http-api.md](api/http-api.md) |

The component model and request lifecycle diagrams are the only two reproduced
elsewhere — both appear in the root README as well, so that it stays readable
without following a link. Each copy names its owner, and the two are edited
together.

## Glossary

Four terms are used consistently across every page, and never swapped for a
synonym.

| Term | Means |
| --- | --- |
| **Request listener** | The anonymous arrow function registered on the server at `server.js:L6-L10`, which runs once per request |
| **Startup callback** | The anonymous arrow function passed to `server.listen()` at `server.js:L12-L14`, which runs once when the socket is bound |
| **Loopback binding** | The consequence of the `hostname` constant at `server.js:L3`: the listener accepts connections only from the local machine |
| **Catch-all response** | The single identical application-level reply — `200`, `text/plain`, `Hello, World!` — that every request receives, because the request listener never inspects the request |

## Generated output, and where it is not

Two commands generate reference material from the JSDoc annotations in
`server.js`:

```bash
npm run docs:api
npm run docs:md
```

The first writes an HTML reference, the second a Markdown one. Both write into
`docs/api/generated/`, which is git-ignored build output: it is never committed,
and **no page in this corpus ever links into it**, because such a link would be
broken for any reader who has not run the generator. The authored, committed
reference is [api/server-module.md](api/server-module.md), which is readable
with no build step at all.

Neither command works on a bare checkout without one prerequisite each, and they
differ in which: `docs:api` needs `npm install` (or `npm ci`) to have installed
the declared `jsdoc` devDependency, while `docs:md` fetches its generator over
the network with `npx --yes --ignore-scripts jsdoc-to-markdown@9.1.3`.

That fetch is why `docs:md` is optional and manual. Its version pin covers the
top-level package only — the transitive closure is resolved fresh and is not
locked to integrity hashes — so it downloads and runs third-party code that can
differ between runs. Use it in a disposable environment under an unprivileged
account, never in an automated gate, and read
[api/server-module.md](api/server-module.md) for the full trade-off and for how
to lock the generator outside this repository.
[getting-started/installation.md](getting-started/installation.md) owns the
install step and [../CONTRIBUTING.md](../CONTRIBUTING.md) documents both
commands in full.

## See also

- [README](../README.md) — the canonical overview this corpus expands.
- [CONTRIBUTING.md](../CONTRIBUTING.md) — conventions, gates, and how to add a
  page.
