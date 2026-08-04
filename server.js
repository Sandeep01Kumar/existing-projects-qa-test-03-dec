/**
 * @file Minimal, single-module Node.js HTTP service that answers every inbound
 * request identically with a plain-text `Hello, World!` greeting.
 *
 * @module server
 *
 * @description
 * This file is the entire application: fourteen lines of executable substance
 * with no framework, no router, and no runtime dependencies. Four of its
 * properties are surprising enough to be stated outright rather than left for a
 * reader to infer from the code.
 *
 * 1. **It exports nothing.** There is no `module.exports` and no `exports.*`
 *    assignment anywhere in the file, so there is no value to import from it.
 * 2. **Requiring it binds a listening socket as an import-time side effect.**
 *    That side effect *is* this module's entire observable contract. Merely
 *    `require()`-ing or `import`-ing the file opens a TCP listener, so a reader
 *    who assumes the module is inert on import will bind a port by accident.
 * 3. **The request listener never inspects `req`.** Method, path, query string,
 *    headers, and body are all ignored, so no routing and no method
 *    discrimination exist and every request receives a byte-identical response.
 *    Verified by execution: `GET /`, `GET /api/anything`, and `POST /whatever`
 *    return identical status, headers, and body.
 * 4. **Reachability is restricted to the local machine.** Binding the loopback
 *    hostname means no other host can reach this service at all.
 *
 * Line references throughout this file (`L1` through `L14`) point at the
 * original, unannotated fourteen-line layout of `server.js`. That numbering is
 * the canonical citation basis shared by the whole documentation corpus, so it
 * is kept deliberately even though these comment blocks shift the physical line
 * numbers of the statements they describe.
 *
 * @requires http
 *
 * @author hxu
 * @license MIT
 * @since 1.0.0
 *
 * @example
 * // Start the service from the repository root:
 * //   $ node server.js
 * //
 * // Captured stdout, exactly one line:
 * //   Server running at http://127.0.0.1:3000/
 *
 * @see {@link https://nodejs.org/docs/latest-v22.x/api/http.html|Node.js `http` module documentation}
 */
/**
 * @callback RequestHandler
 *
 * @description
 * Signature of the request listener registered on the server at L6-L10.
 *
 * That function is an anonymous inline arrow expression, so it has no identifier
 * for a conventional doc block to bind to. This `@callback` typedef exists to
 * give it a documented, referenceable name, which is the standards-sanctioned
 * way to describe a callback's parameters and return value and to make that name
 * usable as a type.
 *
 * The handler runs once per inbound request and composes the reply in three
 * ordered steps: status code (L7), then response header (L8), then body plus
 * termination (L9). Status and header are set through the individual
 * `res.statusCode` property and the `res.setHeader()` call; no combined
 * status-and-headers helper is used anywhere in this file, so the head is
 * flushed implicitly by `res.end()` at L9.
 *
 * @param {http.IncomingMessage} req - The inbound request. **Never read.** No
 * property of it is inspected anywhere in the handler, neither `method`, `url`,
 * nor `headers`, and the body stream is never consumed. That omission is exactly
 * why every request receives the same response and why the service has no
 * routing and no method discrimination.
 * @param {http.ServerResponse} res - The outbound response stream the reply is
 * composed on. It is mutated in place.
 *
 * @returns {void} Nothing. The reply reaches the client as a side effect of
 * writing to `res`, never through a return value.
 *
 * @listens http.Server#event:request
 *
 * @example
 * // Every request produces this same exchange, whatever its method or path:
 * //   $ curl -i -X POST 'http://127.0.0.1:3000/any/path?ignored=1'
 * //   HTTP/1.1 200 OK
 * //   Content-Type: text/plain
 * //   Connection: keep-alive
 * //   Keep-Alive: timeout=5
 * //   Content-Length: 14
 * //
 * //   Hello, World!
 */
/**
 * @callback ServerStartupCallback
 *
 * @description
 * Signature of the startup callback handed to `server.listen()` at L12-L14.
 *
 * Like the request listener it is an anonymous inline arrow expression with no
 * identifier of its own, so this `@callback` typedef supplies its documented
 * name.
 *
 * Node invokes it exactly once, after the socket has been bound successfully and
 * the server has begun accepting connections. Its whole body is the single
 * `console.log` at L13, which writes the readiness banner to **stdout**; that
 * write is its only effect. It performs no health check, validates nothing,
 * reads no state, and returns no value. If the bind fails instead, for example
 * with `EADDRINUSE` when port 3000 is already held by another process, this
 * callback is never reached, because the failure surfaces as an `error` event
 * that this file deliberately does not handle.
 *
 * @returns {void} Nothing; the banner is emitted purely as a side effect.
 *
 * @listens http.Server#event:listening
 *
 * @example
 * // Captured stdout the moment the socket is bound, exactly one line:
 * //   Server running at http://127.0.0.1:3000/
 */
/**
 * Node.js core HTTP module namespace, and this module's only dependency.
 *
 * `http` is a **core** module: it ships bundled with the Node.js runtime, so it
 * is never installed, never appears in `package.json`, and needs no
 * `npm install` step. That is why this project has zero runtime dependencies and
 * why `npm install` here materialises only the optional documentation toolchain.
 *
 * @constant
 * @type {module:http}
 * @requires http
 * @see {@link https://nodejs.org/docs/latest-v22.x/api/http.html|Node.js `http` module documentation}
 */
const http = require('http'); // Loads Node's built-in HTTP module; a core module, so no npm install is involved.

/**
 * IPv4 loopback address that the server socket is bound to.
 *
 * Binding `127.0.0.1` rather than `0.0.0.0` confines the listener to the loopback
 * interface, and that has a consequence which matters more than any other single
 * line in this file: **the service is unreachable from any other machine.**
 * Confirmed empirically -- a request to the host's non-loopback address on port
 * 3000 receives no response at all, while `127.0.0.1:3000` responds normally.
 *
 * There is no environment-variable override. The value is a compile-time literal,
 * so changing it means editing this line and restarting the process. Fronting the
 * service with a reverse proxy is preferable to widening the bind address.
 *
 * @constant {string}
 * @default '127.0.0.1'
 * @see docs/getting-started/configuration.md -- owning document for both
 * configuration options.
 * @see docs/guides/deployment.md -- owning document for the loopback constraint
 * and the reverse-proxy alternative.
 */
const hostname = '127.0.0.1'; // The IPv4 loopback literal; scopes reachability to this machine only.
/**
 * TCP port that the server socket is bound to.
 *
 * The port must be free when the process starts. If another process already holds
 * it, the bind fails with `EADDRINUSE`; because this file installs no `error`
 * listener, that surfaces as an unhandled `error` event and the process exits
 * non-zero without ever printing the readiness banner.
 *
 * As with `hostname` there is no environment-variable override -- the value is a
 * compile-time literal, so changing it means editing this line and restarting.
 *
 * @constant {number}
 * @default 3000
 * @see docs/getting-started/configuration.md -- owning document for both
 * configuration options.
 * @see docs/guides/troubleshooting.md -- port-conflict remediation.
 */
const port = 3000; // The TCP port the listener will bind.

/**
 * The HTTP server instance.
 *
 * Produced by the factory `http.createServer([options][, requestListener])`. The
 * single argument supplied here is the `requestListener`, whose signature is
 * documented as {@link RequestHandler}; Node registers it for the server's
 * `request` event, so it runs once per inbound request.
 *
 * Construction alone does **not** open a socket. The server stays idle until
 * `server.listen()` is called at L12, which is where the port is actually bound
 * and where the {@link ServerStartupCallback} is supplied.
 *
 * @constant {http.Server}
 * @type {http.Server}
 * @see {@link https://nodejs.org/docs/latest-v22.x/api/http.html#class-httpserver|Node.js `http.Server` class documentation}
 * @see {@link https://nodejs.org/docs/latest-v22.x/api/http.html#httpcreateserveroptions-requestlistener|Node.js `http.createServer()` documentation}
 */
const server = http.createServer((req, res) => { // Instantiates an http.Server and registers the per-request listener.
  res.statusCode = 200; // Sets the status line; must precede any body byte written.
  res.setHeader('Content-Type', 'text/plain'); // Declares the payload MIME type; must precede res.end.
  res.end('Hello, World!\n'); // Writes the 14-byte body and ends the response, flushing the implicit head.
}); // Closes the request-listener body and the createServer invocation.

server.listen(port, hostname, () => { // Binds the socket and begins accepting connections; async, fires on 'listening'.
  // Emits the human-readable readiness banner, interpolating hostname and port.
  console.log(`Server running at http://${hostname}:${port}/`);
}); // Closes the startup callback and the listen invocation.
