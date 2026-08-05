# Configuration

This page is the complete reference for the service's two configuration
options, and it **owns those two options for the whole documentation corpus**:
the root README, the deployment guide and the code walkthrough all link here
rather than restating them. Both options are constants declared in the
application's only source file, so this page derives from a two-line span of
it. Every command shown below was executed and every transcript is the literal
output it produced.

Source files this page derives from: `server.js:L1-L14`, the whole module. The
two options are declared at `server.js:L3-L4`, consumed at `server.js:L12-L13`,
and the absence of any environment-variable indirection is a property of the file
as a whole rather than of either declaration.

## The configuration model

The model is worth establishing before the options themselves, because it is
what explains an option matrix with no environment-variable column and no
deploy-time override.

Both options are **compile-time source constants**, not runtime inputs. They
are literals in the module, evaluated once when the file is loaded, and fixed
thereafter for the lifetime of the process.
`Source: server.js:L3`, `Source: server.js:L4`

There is **no external configuration surface of any kind**. Each of the
following was probed individually and is absent from the repository:

- no `config/` directory
- no `.env` and no `.env.example`
- no `.npmrc`
- no `.nvmrc`, `.node-version` or `.tool-versions`
- no `Dockerfile`, `docker-compose.yml` or `Procfile`
- no `.github/` directory

No configuration file of any format exists to be read, so there is nothing to
mount, template or override when the service is deployed.

**No environment variable is read.** `process.env` does not appear anywhere in
the module, so no variable reaches either constant however conventionally it is
named. The last section on this page shows the captured proof.
`Source: server.js:L3`, `Source: server.js:L4`

**No command-line argument is parsed.** The module reads neither `process.argv`
nor any argument-parsing library, so anything passed after the filename is
ignored.

**Configuration cannot be injected by importing the module either.** The module
declares no `module.exports`, so there is no exported value for a caller to
reach in and reconfigure. Requiring the file does not hand back a configurable
server: it binds a listening socket as an import-time side effect, using the
constants already compiled in. `Source: server.js:L1-L14`

Editing the source is therefore the only mechanism that changes either value,
which is what the procedure further down this page documents.

## Option matrix

| Option | Type | Default | Declared at | Effect | Override mechanism |
| --- | --- | --- | --- | --- | --- |
| `hostname` | `string` | `'127.0.0.1'` | `server.js:L3` | The interface the listener binds. The IPv4 loopback address, so only the local machine can connect | Edit the constant in the source, then restart the process. No file, variable or flag is read |
| `port` | `number` | `3000` | `server.js:L4` | The TCP port the listener binds. Passed as the first argument to `server.listen` | Edit the constant in the source, then restart the process. No file, variable or flag is read |

Both values are consumed together in a single call, and the argument order is
`port` first and `hostname` second — the reverse of the order they are usually
named in when written out as an address. `Source: server.js:L12`

Both are also interpolated into the startup banner, which is a template literal
over the same two constants rather than a second hardcoded copy of them.
`Source: server.js:L13`

That is the causal chain worth carrying: each constant is read once at load,
both feed `server.listen`, and both feed the banner. It is why an override
takes a restart, and why a successful override is visible in the very first
line the process prints.

Neither value can be supplied from outside the file, and that includes supplying
it from code. The module exports nothing — there is no `module.exports` anywhere
in `server.js` — so configuration cannot be injected by importing the module:
requiring it yields an empty exports object and, as a side effect of the import,
binds the socket using the constants already compiled in.
`Source: server.js:L1-L14` Editing the constants is therefore the only mechanism
there is.

## Option: hostname

Default `'127.0.0.1'`, written in the source as a single-quoted string literal.
`Source: server.js:L3`

`127.0.0.1` is the IPv4 loopback address. A listener bound to it accepts
connections arriving over the loopback interface only, so only clients running
on the same machine can reach the service.

That is the *loopback binding* constraint. Its practical consequence is that
the service cannot be reached from another host at all, and that a request sent
to the machine's own non-loopback address gets no response — the connection is
refused beneath Node, so there is no log line to explain it. The constraint,
the captured evidence for it, and the two ways of changing reachability are
owned by [../guides/deployment.md](../guides/deployment.md).

This value also appears in the startup banner, interpolated from the same
constant, so the banner always reports the address actually bound.
`Source: server.js:L13`

## Option: port

Default `3000`, written in the source as a bare number literal rather than a
string. `Source: server.js:L4`

This is the TCP port the listener binds, and it is passed as the **first**
argument to `server.listen`, ahead of `hostname`. `Source: server.js:L12`

If another process already holds the port, the bind fails. The module registers
no `error` handler on the server, so that failure surfaces as an unhandled
`'error'` event and the process **crashes** — it does not retry, fall back to
another port, or degrade in any other way. Captured from a second instance
started while the first still held the port:

```text
Error: listen EADDRINUSE: address already in use 127.0.0.1:3000
```

Three parts of the real output are left out: the four-line unhandled-`'error'`
preamble Node prints ahead of that line, the stack frames between it and the
block below, and the trailing version line at the very end. Each is omitted
because [../guides/troubleshooting.md](../guides/troubleshooting.md) owns the
complete transcript. The error object carries the specifics, and the two values
it names are exactly the two constants documented on this page:

```text
  code: 'EADDRINUSE',
  errno: -98,
  syscall: 'listen',
  address: '127.0.0.1',
  port: 3000
}
```

Both blocks above are excerpts from the failing process's standard error. It
exited with status `1` and wrote nothing to standard output, so no banner
appears — a missing banner is the symptom. `errno` is platform-specific — `-98`
on Linux — while the code, the syscall, and the address and port are the stable
parts worth matching on. The full transcript with its stack frames, and the
per-platform commands for finding and freeing whatever holds the port, are owned
by
[../guides/troubleshooting.md](../guides/troubleshooting.md).

This value is likewise interpolated into the startup banner.
`Source: server.js:L13`

## Changing an option

Editing the constant in the source is the entire procedure. Read what follows
as instructions for your own copy of the repository: nothing in this
documentation pass changes either value, and both remain at the defaults
recorded above.

These are the two lines to locate, shown exactly as they stand in the
unannotated source and without the inline commentary that now accompanies them:

```javascript
const hostname = '127.0.0.1';
const port = 3000;
```

`Source: server.js:L3` and `Source: server.js:L4`

For the annotated form of the same two lines, with the surrounding JSDoc and
the per-line explanations, see
[../architecture/code-walkthrough.md](../architecture/code-walkthrough.md).

The procedure is four steps:

1. Stop the running process. Nothing rereads the source while the process is
   alive, so an edit cannot take effect before it restarts.
2. Edit the constant in `server.js` — the `hostname` string, the `port` number,
   or both.
3. Save the file.
4. Start the process again.

[installation.md](installation.md) owns the run and stop commands. The run
command is a single line:

   ```bash
   node server.js
   ```

The change takes effect **only on restart**. Each constant is evaluated once,
when the module is loaded, and the module is loaded once per process; the file
contains no reload path, no file watching and no signal handling. A process
that is already running therefore keeps the values it started with until it is
stopped and started again. `Source: server.js:L3`, `Source: server.js:L4`

Confirming an override needs nothing more than reading the first line of
output. Because the banner is a template literal over both constants rather
than a hardcoded string, whatever is in force appears there immediately.
`Source: server.js:L13`

Captured output **after** that edit — the banner names 8080, not 3000:

```text
Server running at http://127.0.0.1:8080/
```

It reports the new value because it is interpolated from the constant rather
than written out a second time, so the banner always names the port actually in
force. `Source: server.js:L13`

**The repository itself ships `3000`**, so no run of the committed source can
print `8080`: the transcript above was captured from a copy whose `port`
constant had been changed exactly as this procedure describes.

The service now answers there and nowhere else. Captured against the edited
file, using the same five flags [installation.md](installation.md) tabulates —
`--silent` removes the progress meter and `--show-error` keeps any diagnostic,
so the block below is the whole of what the command printed:

```bash
curl --noproxy '*' --include --silent --show-error --max-time 5 http://127.0.0.1:8080/
```

```http
HTTP/1.1 200 OK
Content-Type: text/plain
Date: Wed, 05 Aug 2026 01:00:04 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 14

Hello, World!
```

The same request to port 3000 fails with `curl` exit code 7, because nothing is
listening there any more. The response contract itself is unchanged — only the
port moved — and it is owned by [../api/http-api.md](../api/http-api.md).

The banner for the **unedited** default is in
[installation.md](installation.md), which owns the run step; it is deliberately
not repeated inside this procedure, so that the output shown here is the output
this procedure actually produces. A banner still showing the old value means the
process was never restarted.

## Why there is no environment-variable support

`process.env` is never read anywhere in the module. That deserves stating
outright rather than leaving to inference, because reading a port from the
environment is close to universal in Node services, and assuming this one does
it costs real debugging time.

Verified, with no other instance running. The command below uses POSIX
inline-environment syntax, so it runs as written on Linux and macOS:

```bash
PORT=8080 node server.js
```

Captured output — the banner still reports `3000`:

```text
Server running at http://127.0.0.1:3000/
```

The other half of the same observation is that nothing is listening on 8080:

```bash
curl --noproxy '*' --include --silent --show-error --max-time 5 http://127.0.0.1:8080/; echo "curl exit code: $?"
```

```text
curl: (7) Failed to connect to 127.0.0.1 port 8080 after 0 ms: Could not connect to server
curl exit code: 7
```

The diagnostic line comes first because `--show-error` keeps it even under
`--silent`, and `curl` writes it before the shell reaches `echo`. Above it there
is no status line and no header block at all: exit code 7 is "failed to
connect", so no response was ever received to print. Meanwhile `127.0.0.1:3000`
answered normally throughout:

```bash
curl --noproxy '*' --silent --show-error --max-time 5 http://127.0.0.1:3000/; echo "curl exit code: $?"
```

```text
Hello, World!
curl exit code: 0
```

The command therefore starts the service on port 3000, exactly as if the
variable had not been set: nothing consumes it. Stopping that process is the
ordinary procedure — `Ctrl+C` in its terminal, which is an immediate termination
because no shutdown handler exists — and the port is released as it exits; see
[installation.md](installation.md), which owns the run and stop steps.

Windows shells have no inline-prefix form, so the equivalent demonstrations
there are `$env:PORT=8080; node server.js` in PowerShell and
`set PORT=8080 && node server.js` in `cmd`. Both print the same banner, for the
same reason: the value is set, and then nothing reads it.

The variable was set and had no effect whatsoever: the banner reports `3000`.
Reading the kernel's own socket table settles where the listener actually is,
rather than taking the banner's word for it. The filter names both ports, so a
row for either one would appear:

```bash
ss -ltn '( sport = :3000 or sport = :8080 )'
```

```text
State  Recv-Q Send-Q Local Address:Port Peer Address:Port
LISTEN 0      511        127.0.0.1:3000      0.0.0.0:*   
```

One row came back, and it is `127.0.0.1:3000`. The requested `8080` is absent
because nothing ever bound it — the same conclusion the failed `curl` above
reached from the other direction. `ss` is Linux-only. The portable equivalent
probes by connecting instead of by reading the socket table, and it is the port
check owned by [../guides/troubleshooting.md](../guides/troubleshooting.md);
that probe hardcodes `127.0.0.1:3000` and accepts no port argument, so it
answers the 3000 half only, reporting `port 3000 on 127.0.0.1: IN USE` against
this same process.

Nothing is half-configured either — the default port kept answering normally
throughout. The variable is simply not consumed by anything.
`Source: server.js:L3`, `Source: server.js:L4`

This is a deliberate exclusion rather than an oversight. The project is a
minimal fixture with zero runtime dependencies and no configuration layer at
all, and environment-variable configuration sits among the capabilities the
design leaves out on purpose, alongside routing, TLS, authentication and
graceful shutdown. This documentation describes that absence instead of
remedying it.

Adding support would change the application rather than its documentation.
Each literal would become an environment lookup with the present value as its
fallback, and `port` would additionally need a string-to-number conversion,
because every value in `process.env` arrives as a string — handing the string
`'8080'` to `server.listen` is not the same call as handing it the number
`8080`. Anything robust would also validate that the result is an integer
inside the legal port range, and fail loudly when it is not.

That is **feature work and out of scope** for this documentation change, which
adds comments and pages without altering a single executable statement. The one
line below is illustrative only and is **not** the current state of the source:

```javascript
const port = Number(process.env.PORT) || 3000;
```

The repository contains no such line. What it contains is the bare literal
cited above. `Source: server.js:L4`

## See also

- [installation.md](installation.md) — owner of the runtime baseline and of the
  install, run and stop procedure this page defers to.
- [../guides/deployment.md](../guides/deployment.md) — owner of the *loopback
  binding* constraint, reverse-proxy fronting and the hardening gaps.
- [../guides/troubleshooting.md](../guides/troubleshooting.md) — owner of
  `EADDRINUSE` remediation, including how to find and free the owning process.
- [../architecture/code-walkthrough.md](../architecture/code-walkthrough.md) —
  the annotated reading of all 14 lines, with these two constants in context.
- [../api/http-api.md](../api/http-api.md) — the HTTP contract served at the
  address these two options determine.
- [../README.md](../README.md) — the documentation index, the glossary of the
  four fixed terms, and which page owns which fact.
- [../../README.md](../../README.md) — the canonical project overview, whose
  Configuration section this page expands.
