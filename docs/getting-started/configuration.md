# Configuration

The service has exactly two configuration options, both of them constants in the
source. This page owns those two facts for the whole documentation corpus.

Source files this page derives from: `server.js:L3-L4`.

## The configuration model

There is no configuration file, no `config/` directory, no `.env`, and no
command-line argument parsing. Configuration is two literals compiled into the
module, read once when the file is evaluated:

| Option | Type | Value | Source | What it controls |
| --- | --- | --- | --- | --- |
| `hostname` | string | `127.0.0.1` | `server.js:L3` | The interface the listener binds. Loopback, so only the local machine can connect |
| `port` | number | `3000` | `server.js:L4` | The TCP port the listener binds |

Both are passed to `server.listen(port, hostname, ...)` at `server.js:L12`, and
both are interpolated into the startup banner at `server.js:L13`, which is why
the banner always shows the values actually in force.

## Option: hostname

Default `127.0.0.1`, the IPv4 loopback address.

This is the single most consequential value in the file, and its consequence is
easy to miss: binding loopback rather than `0.0.0.0` means the service is
**unreachable from any other machine**. A request from another host is refused at
the transport layer, so there is no log line and no response to explain it. The
constraint, the evidence for it, and the two ways to change it are owned by
[../guides/deployment.md](../guides/deployment.md).

## Option: port

Default `3000`.

If another process already holds the port, `server.listen()` emits an `error`
event that nothing handles, so the process exits with an unhandled
`EADDRINUSE`. That failure and its remedies are covered in
[../guides/troubleshooting.md](../guides/troubleshooting.md).

## Changing an option

Editing a constant is the whole procedure. To move the service to port 8080:

1. Open `server.js` and change the `port` constant at `server.js:L4` from `3000`
   to `8080`.
2. Stop the running process with `Ctrl+C`.
3. Start it again with `node server.js`.

```bash
node server.js
```

The banner reflects the new value, because it is interpolated from the constant
rather than hardcoded a second time:

```text
Server running at http://127.0.0.1:3000/
```

The line above is the captured banner for the **default** port; after changing
the constant to 8080 the same command prints the same sentence with `8080` in
place of `3000`. There is no reload mechanism, so a process that is already
running keeps the values it started with until it is stopped and started again.

## Why no environment variables

`process.env` is never read anywhere in `server.js`. That is worth stating
plainly because the opposite is the norm in Node services, and the assumption
costs people time:

```bash
PORT=8080 node server.js
```

That command starts the service on port 3000, exactly as if the variable had not
been set. Nothing consumes it.

Adding environment support would mean reading `process.env.PORT` and
`process.env.HOSTNAME` with the current literals as fallbacks, and validating
that a supplied port is an integer in range. That is a behaviour change to the
application rather than a documentation change, so it is deliberately not part
of this documentation pass — see the non-goals list in
[../../README.md](../../README.md).

## See also

- [../../README.md](../../README.md) — the canonical overview, whose
  Configuration section this page expands.
- [installation.md](installation.md) — the runtime baseline and the install
  procedure.
- [../guides/deployment.md](../guides/deployment.md) — owner of the
  loopback-binding constraint.
- [../architecture/code-walkthrough.md](../architecture/code-walkthrough.md) —
  where these two constants sit among the module's 14 lines.
