/**
 * @file Minimal, single-module Node.js HTTP service whose single request listener
 * composes the same `200` plain-text `Hello, World!` reply for every ordinary
 * inbound request, whatever the request's method or path.
 *
 * @module server
 *
 * @description
 * This file is the entire application. Its original unannotated executable
 * layout is 14 content lines -- 11 lines of code and 3 blank separators -- with
 * no framework, no router, and no runtime dependencies; the annotation layer
 * documented here makes the physical file considerably longer than that, and the
 * 14-line layout is the citation basis described below rather than the file's
 * current length. Four of the module's properties are surprising enough to be
 * stated outright rather than left for a reader to infer from the code.
 *
 * 1. **It defines no public export.** There is no `module.exports` and no
 *    `exports.*` assignment anywhere in the file. CommonJS still hands a
 *    `require()` call the module's default, empty `module.exports` object, but
 *    nothing meaningful can be read from it.
 * 2. **Requiring it binds a listening socket as an import-time side effect.**
 *    That side effect *is* this module's entire observable contract. Merely
 *    `require()`-ing or `import`-ing the file opens a TCP listener, so a reader
 *    who assumes the module is inert on import will bind a port by accident.
 * 3. **The request listener never inspects `req`.** Method, path, query string,
 *    headers, and body are all ignored, so no routing and no method
 *    discrimination exist: this application assigns the same `200` status, the
 *    same `text/plain` content type, and the same greeting to every request Node
 *    dispatches to the listener through the server's `request` event. That
 *    invariance is what the *application* controls, and it stops there: the
 *    bytes on the wire are **not** identical from one request to the next,
 *    because the runtime -- not this file -- frames the transport (see the
 *    transport-behaviour list below).
 * 4. **Reachability is restricted to the local machine.** Binding the loopback
 *    hostname means no other host can reach this service at all.
 *
 * Several transport behaviours belong to Node rather than to this file, and each
 * one qualifies point 3 above. The four below are the ones that matter in
 * practice, and they are stated here so that "the same response" is never read as
 * "the same bytes".
 *
 * - **A `Date` header is generated on every response.** `http.Server` sends it by
 *   default, and its value advances with the clock, so two responses emitted in
 *   different seconds cannot be byte-identical.
 * - **`Connection` and `Keep-Alive` are derived from the request.** An HTTP/1.1
 *   request that permits reuse is answered with `Connection: keep-alive` and
 *   `Keep-Alive: timeout=5`; a request carrying `Connection: close`, and any
 *   HTTP/1.0 request, is answered with `Connection: close` and no `Keep-Alive`.
 *   An HTTP/1.0 reply is additionally close-delimited, so it carries no
 *   `Content-Length` at all.
 * - **A `HEAD` request receives the head only.** Node knows a HEAD response
 *   carries no body, so the greeting handed to `res.end()` at L9 is discarded
 *   and no `Content-Length` is framed. The handler itself still runs unchanged;
 *   the suppression happens beneath it, inside the runtime.
 * - **A `CONNECT` request never reaches the listener.** Node routes it to the
 *   separate `connect` event, which this file does not handle, so the socket is
 *   closed without a single response byte.
 *
 * Line references throughout this file (`L1` through `L14`) point at the
 * original, unannotated 14-content-line layout of `server.js`. That numbering is
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
 * @see {@link https://nodejs.org/docs/latest-v22.x/api/http.html|Node.js http module documentation}
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
 * The handler runs once per request that Node dispatches through the server's
 * `request` event, and composes the reply in three ordered steps: status code
 * (L7), then response header (L8), then payload plus termination (L9). Status and
 * header are set through the individual `res.statusCode` property and the
 * `res.setHeader()` call; no combined status-and-headers helper is used anywhere
 * in this file, so the head is flushed implicitly by `res.end()` at L9.
 *
 * Some requests are answered differently, and none of those differences
 * originates here. The cases below are the ones that matter in practice rather
 * than an exhaustive account of what the runtime does:
 *
 * - A `CONNECT` request never reaches this function at all: Node routes it to the
 *   separate `connect` event, which this file does not handle, so the socket is
 *   closed with no response.
 * - An HTTP/1.1 request carrying an `Expect` header Node does not honour --
 *   anything other than `100-continue` -- is answered `417 Expectation Failed` by
 *   Node itself and the `request` event never fires, so this function never runs.
 *   The same header on an HTTP/1.0 request is ignored and the ordinary reply
 *   follows, because HTTP/1.0 defines no expectation for the runtime to refuse.
 * - For a `HEAD` request Node discards the payload handed to `res.end()` before it
 *   reaches the wire, so the client receives the status line and headers with no
 *   body and no `Content-Length`. This function still runs unchanged.
 *
 * @param {http.IncomingMessage} req - The inbound request. **Never read by
 * application logic.** No property of it is inspected anywhere in the handler,
 * neither `method`, `url`, nor `headers`, and the body stream is never read here
 * either. That omission is exactly why every request reaching this handler
 * receives the same application-level reply -- the same status, content type, and
 * greeting -- and why the service has no routing and no method discrimination.
 *
 * "Never read by application logic" is narrower than "never consumed", and the
 * difference matters for resource analysis. Once the response finishes, Node
 * discards any request body the application left unread, so the bytes are still
 * received over the network, still buffered by the runtime, and still hold the
 * connection open while they arrive -- they are simply thrown away instead of
 * being delivered anywhere. Verified: a 5 MB body sent after this handler had
 * already replied was consumed in full, and a second request on the same
 * connection was answered normally, which is only possible because the runtime
 * drained the first one.
 *
 * The runtime, not this file, then frames the response, and two of the things it
 * does are derived from the very request this handler ignores: the
 * `Connection`/`Keep-Alive` pair follows the request's protocol version and its
 * own `Connection` header, and the body is suppressed for a `HEAD` request. The
 * `Date` header is different in kind -- Node generates it from the clock, so it
 * reflects when the response was produced rather than anything the request
 * carried. See docs/api/http-api.md for the request-flow contract and
 * docs/architecture/request-lifecycle.md for the resource consequences.
 * @param {http.ServerResponse} res - The outbound response stream the reply is
 * composed on. It is mutated in place.
 *
 * @returns {void} Nothing. The reply reaches the client as a side effect of
 * writing to `res`, never through a return value.
 *
 * @listens http.Server#event:request
 *
 * @example
 * // One illustrative exchange. Any ordinary body-bearing request -- whatever its
 * // method, path, or query -- is answered with the same status, content type, and
 * // greeting, so the handler's contribution is invariant; the header block below
 * // is representative rather than exhaustive:
 * //   $ curl --noproxy '*' --include --silent --show-error --max-time 5 \
 * //       --request POST 'http://127.0.0.1:3000/any/path?ignored=1'
 * //   HTTP/1.1 200 OK
 * //   Content-Type: text/plain
 * //   Date: Tue, 04 Aug 2026 21:59:34 GMT
 * //   Connection: keep-alive
 * //   Keep-Alive: timeout=5
 * //   Content-Length: 14
 * //
 * //   Hello, World!
 * //
 * // Only the status line, the `Content-Type` line, and the body come from this
 * // handler; `Content-Length` is derived by Node from that body. `Date` is
 * // generated by Node and records when the response was produced, so it **may**
 * // differ between any two responses and always differs across a second
 * // boundary, while two responses produced within the same second carry the same
 * // value. The `Connection`/`Keep-Alive` pair reflects the request's protocol
 * // version and its own `Connection` header -- so the wire bytes can differ
 * // between requests even though the application-level reply does not. A
 * // `CONNECT` request never reaches this handler and receives no response at all.
 *
 * @example
 * // `HEAD` is the one method whose reply differs structurally. The handler runs
 * // exactly as above, but Node discards the body it was given and frames no
 * // `Content-Length`:
 * //   $ curl --noproxy '*' --include --silent --show-error --max-time 5 \
 * //       --head http://127.0.0.1:3000/
 * //   HTTP/1.1 200 OK
 * //   Content-Type: text/plain
 * //   Date: Tue, 04 Aug 2026 21:59:34 GMT
 * //   Connection: keep-alive
 * //   Keep-Alive: timeout=5
 * //
 * //   (no body)
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
 * write is its only effect. The banner is interpolated from the two immutable
 * constants the callback closes over, `hostname` (L3) and `port` (L4), and those
 * are the only state it reads. It performs no health check, validates nothing,
 * queries no runtime state, and returns no value. If the bind fails instead, for
 * example with `EADDRINUSE` when port 3000 is already held by another process,
 * this callback is never reached, because the failure surfaces as an `error`
 * event that this file deliberately does not handle.
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
 * @see {@link https://nodejs.org/docs/latest-v22.x/api/http.html|Node.js http module documentation}
 */
const http = require('http'); // Loads Node's built-in HTTP module; a core module, so no npm install is involved.

/**
 * IPv4 loopback address that the server socket is bound to.
 *
 * Binding `127.0.0.1` rather than `0.0.0.0` confines the listener to the loopback
 * interface, and that has a consequence which matters more than any other single
 * line in this file: **the service is unreachable from any other machine.** Only
 * clients running on this host can reach it directly; a request addressed to any
 * of the host's non-loopback addresses never arrives at this listener.
 *
 * There is no environment-variable override. The value is a hard-coded source
 * literal, so changing it means editing this line and restarting the process.
 * Fronting the service with a reverse proxy is preferable to widening the bind
 * address.
 *
 * @constant {string}
 * @default '127.0.0.1'
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
 * hard-coded source literal, so changing it means editing this line and
 * restarting.
 *
 * @constant {number}
 * @default 3000
 */
const port = 3000; // The TCP port the listener will bind.

/**
 * The HTTP server instance.
 *
 * Produced by the factory `http.createServer([options][, requestListener])`. The
 * single argument supplied here is the `requestListener`, whose signature is
 * documented as {@link module:server~RequestHandler|RequestHandler}; Node
 * registers it for the server's `request` event, so it runs once per request Node
 * dispatches through that event -- which is not the same as once per inbound
 * connection or once per byte sequence a client sends. A `CONNECT` is routed to
 * the `connect` event instead, and a request carrying an unsupported `Expect`
 * header is answered by Node before the listener is consulted; neither reaches
 * this function.
 *
 * Construction alone does **not** open a socket. The server stays idle until
 * `server.listen()` is called at L12, which is where the port is actually bound
 * and where the
 * {@link module:server~ServerStartupCallback|ServerStartupCallback} is supplied.
 *
 * @constant {http.Server}
 * @type {http.Server}
 * @see {@link https://nodejs.org/docs/latest-v22.x/api/http.html#class-httpserver|Node.js http.Server class documentation}
 * @see {@link https://nodejs.org/docs/latest-v22.x/api/http.html#httpcreateserveroptions-requestlistener|Node.js http.createServer() documentation}
 */
const server = http.createServer((req, res) => { // Instantiates an http.Server and registers the request listener invoked once per request.
  res.statusCode = 200; // Sets the status line; must precede any body byte written.
  res.setHeader('Content-Type', 'text/plain'); // Declares the payload MIME type; must precede res.end.
  res.end('Hello, World!\n'); // Supplies the 14-byte body and terminates the response, flushing the implicit head; for a HEAD, Node discards that body.
}); // Closes the request-listener body and the createServer invocation.

server.listen(port, hostname, () => { // Binds the socket and begins accepting connections; async, fires on 'listening'.
  // Emits the human-readable readiness banner, interpolating hostname and port.
  console.log(`Server running at http://${hostname}:${port}/`);
}); // Closes the startup callback and the listen invocation.
