const http = require('http');

// ---------------------------------------------------------------------------
// Configuration constants
// ---------------------------------------------------------------------------
// The binding contract is preserved: host/port default to 127.0.0.1/3000 so
// existing verification workflows are unaffected. Optional environment
// overrides are honored but always fall back to the documented defaults.
const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 3000;

// HTTP method allowlist. GET drives the documented success path; HEAD is its
// conventional companion (identical headers, no body). Anything else -> 405.
const ALLOWED_METHODS = new Set(['GET', 'HEAD']);
const ALLOW_HEADER = [...ALLOWED_METHODS].join(', ');

// Input-validation limits.
const MAX_URL_LENGTH = 2048; // Reject abusive / over-long request URLs -> 400.
const MAX_BODY_SIZE = 1024 * 1024; // 1 MiB streaming request-body cap  -> 413.

// Timeout settings (milliseconds). These reclaim idle sockets and mitigate
// slow-client attacks such as slowloris.
const HEADERS_TIMEOUT = 60_000;
const REQUEST_TIMEOUT = 30_000;
const KEEP_ALIVE_TIMEOUT = 5_000;
const SOCKET_TIMEOUT = 120_000;

// Upper bound on graceful shutdown before the process is forcibly terminated.
const SHUTDOWN_TIMEOUT = 10_000;
// Short grace window that lets in-flight requests drain before lingering
// sockets are force-closed during shutdown.
const DRAIN_GRACE = 1_000;

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
// Registry of open sockets so shutdown can release them deterministically;
// server.close() alone will not promptly terminate idle keep-alive sockets.
const connections = new Set();

// Idempotency guard so the shutdown routine executes exactly once.
let shuttingDown = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// Lightweight, dependency-free structured logger. Errors are written to
// stderr and everything else to stdout, using the existing template-literal
// style. Format: "[ISO-8601 timestamp] [LEVEL] message".
const log = (level, message) => {
  const line = `[${new Date().toISOString()}] [${level}] ${message}`;
  if (level === 'ERROR') {
    console.error(line);
  } else {
    console.log(line);
  }
};

// Guarded response writer used for every non-200 response. It never writes
// twice: if the headers were already sent or the response has already ended it
// silently no-ops, preventing "headers already sent" crashes.
const safelyRespond = (res, statusCode, body, headers) => {
  if (res.headersSent || res.writableEnded) {
    return false;
  }
  res.statusCode = statusCode;
  if (headers) {
    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
  }
  res.end(body);
  return true;
};

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------
// Every request flows through validation gates (method -> URL -> body) before
// a differentiated response is produced. Layered error handling ensures no
// single fault crashes the process: the synchronous body is wrapped in
// try/catch, the asynchronous routing performed on 'end' has its own guard,
// and stream-level 'error' listeners absorb socket faults.
const requestHandler = (req, res) => {
  // Structured request logging: record the final outcome once the response
  // has been flushed to the socket (covers every branch, including errors).
  res.on('finish', () => {
    log('INFO', `${req.method} ${req.url} -> ${res.statusCode}`);
  });

  // Stream-level error listeners: a socket fault on the request or the
  // response must never escalate into an uncaught exception.
  req.on('error', (err) => {
    log('ERROR', `Request stream error: ${err.message}`);
    safelyRespond(res, 400, 'Bad Request\n', { 'Content-Type': 'text/plain' });
  });
  res.on('error', (err) => {
    log('ERROR', `Response stream error: ${err.message}`);
  });

  try {
    // (1) Method allowlist -> 405 Method Not Allowed (with Allow header).
    if (!ALLOWED_METHODS.has(req.method)) {
      safelyRespond(res, 405, 'Method Not Allowed\n', {
        'Content-Type': 'text/plain',
        Allow: ALLOW_HEADER,
      });
      return;
    }

    // (2) URL length pre-check -> 400 Bad Request. Guards against abusive
    // URLs before the (more expensive) parse below.
    if (typeof req.url !== 'string' || req.url.length > MAX_URL_LENGTH) {
      safelyRespond(res, 400, 'Bad Request\n', { 'Content-Type': 'text/plain' });
      return;
    }

    // (2b) Safe URL parse via the global WHATWG URL constructor -> 400 on
    // failure. A base derived from the Host header lets relative request
    // targets (e.g. "/") parse correctly.
    let parsed;
    try {
      parsed = new URL(req.url, `http://${req.headers.host || HOST}`);
    } catch (parseErr) {
      log('ERROR', `Malformed request URL "${req.url}": ${parseErr.message}`);
      safelyRespond(res, 400, 'Bad Request\n', { 'Content-Type': 'text/plain' });
      return;
    }

    // (3) Body-size enforcement -> 413 Payload Too Large.
    //
    // (3a) Fast path: reject upfront when the declared Content-Length already
    // exceeds the cap, before any body is read. This is the common real-world
    // case (clients such as curl/fetch send a Content-Length) and lets the 413
    // be produced without consuming the payload at all.
    const declaredLength = Number(req.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_SIZE) {
      safelyRespond(res, 413, 'Payload Too Large\n', {
        'Content-Type': 'text/plain',
        Connection: 'close',
      });
      return;
    }

    // (3b) Streaming fallback: for chunked / unknown-length bodies, accumulate
    // chunk *lengths* (never the content) and reject once the running total
    // exceeds the cap. Attaching the 'data' listener also switches the request
    // into flowing mode, so 'end' fires even for bodiless GET/HEAD requests and
    // advances the flow to routing.
    //
    // On exceed we pause reading (applying TCP backpressure so no more of the
    // body is buffered) and respond 413 with "Connection: close" so Node flushes
    // the response and then closes the socket. We deliberately do NOT destroy()
    // the shared request/response socket here: an immediate destroy() emits a
    // TCP RST that discards the still-queued 413 bytes (observed as a client-side
    // ECONNRESET) and suppresses the response's 'finish' event. Pausing plus
    // "Connection: close" fulfils the same resource-protection intent (stop
    // consuming, release the socket) while still emitting a real 413.
    let bodySize = 0;
    let bodyRejected = false;

    req.on('data', (chunk) => {
      if (bodyRejected) {
        return;
      }
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        bodyRejected = true;
        req.pause();
        safelyRespond(res, 413, 'Payload Too Large\n', {
          'Content-Type': 'text/plain',
          Connection: 'close',
        });
      }
    });

    req.on('end', () => {
      // Skip routing if the body was rejected (413) or a response already went
      // out on this request.
      if (bodyRejected || res.writableEnded) {
        return;
      }
      try {
        // (4) Routing / differentiated responses (post-validation).
        if (parsed.pathname === '/') {
          // Preserve the documented success contract byte-for-byte:
          // 200, Content-Type text/plain, body "Hello, World!\n" (14 bytes).
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/plain');
          if (req.method === 'HEAD') {
            // HEAD: identical status/headers, but no body per HTTP semantics.
            res.end();
          } else {
            res.end('Hello, World!\n');
          }
        } else {
          safelyRespond(res, 404, 'Not Found\n', { 'Content-Type': 'text/plain' });
        }
      } catch (routeErr) {
        // (5) Guarded 500 for faults raised while routing.
        log('ERROR', `Routing failure: ${routeErr.stack || routeErr.message}`);
        safelyRespond(res, 500, 'Internal Server Error\n', {
          'Content-Type': 'text/plain',
        });
      }
    });
  } catch (err) {
    // (5) Last-resort per-request guard -> 500, guarded against double-write.
    log('ERROR', `Unhandled request error: ${err.stack || err.message}`);
    safelyRespond(res, 500, 'Internal Server Error\n', {
      'Content-Type': 'text/plain',
    });
  }
};

// ---------------------------------------------------------------------------
// Server construction and resilience
// ---------------------------------------------------------------------------
const server = http.createServer(requestHandler);

// ---------------------------------------------------------------------------
// Graceful shutdown (idempotent)
// ---------------------------------------------------------------------------
// A single teardown path shared by termination signals and fatal-error
// handlers: stop accepting connections, drain in-flight requests, release
// sockets and timers, then exit. A forced-exit timer guarantees termination
// even if draining hangs. Defined before the handlers that reference it so
// there are no forward references.
const shutdown = (exitCode = 0, signalOrReason) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  log(
    'INFO',
    `Shutdown initiated (${signalOrReason || 'manual'}); no longer accepting connections.`
  );

  // Backstop: force exit if graceful drain exceeds the allotted window. The
  // timer is unref'd so it never keeps the event loop alive on its own.
  const forceTimer = setTimeout(() => {
    log('ERROR', `Graceful shutdown exceeded ${SHUTDOWN_TIMEOUT}ms; forcing exit.`);
    for (const socket of connections) {
      socket.destroy();
    }
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);
  forceTimer.unref();

  // After a short grace period for in-flight requests, forcibly close any
  // sockets still lingering (e.g. slow keep-alive clients). Also unref'd.
  const drainTimer = setTimeout(() => {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    for (const socket of connections) {
      socket.destroy();
    }
  }, DRAIN_GRACE);
  drainTimer.unref();

  // Stop accepting new connections; exit once existing ones have drained.
  server.close((err) => {
    clearTimeout(forceTimer);
    clearTimeout(drainTimer);
    if (err) {
      log('ERROR', `Error while closing server: ${err.message}`);
      process.exit(1);
      return;
    }
    log('INFO', 'All connections drained; process exiting cleanly.');
    process.exit(exitCode);
  });

  // Release idle keep-alive sockets immediately so draining completes fast.
  if (typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections();
  }
};

// Listen failures are fatal: the server cannot start, so log an actionable
// message and exit non-zero instead of crashing with an unhandled error.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    log(
      'ERROR',
      `Address already in use: ${HOST}:${PORT} (EADDRINUSE). Is another instance running?`
    );
    process.exit(1);
  } else if (err.code === 'EACCES') {
    log(
      'ERROR',
      `Permission denied binding ${HOST}:${PORT} (EACCES). Try an unprivileged port.`
    );
    process.exit(1);
  } else {
    // Any other server-level error converges on the shared teardown path.
    log('ERROR', `Server error: ${err.message}`);
    shutdown(1, `server-error:${err.code || 'unknown'}`);
  }
});

// Track every connection so shutdown can release lingering sockets, and prune
// the registry as sockets close.
server.on('connection', (socket) => {
  connections.add(socket);
  socket.on('close', () => connections.delete(socket));
});

// Resource cleanup / slowloris mitigation: bound how long headers, whole
// requests, keep-alive idling, and overall socket inactivity may last.
server.headersTimeout = HEADERS_TIMEOUT;
server.requestTimeout = REQUEST_TIMEOUT;
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT;
server.timeout = SOCKET_TIMEOUT;

// ---------------------------------------------------------------------------
// Process-level safety net
// ---------------------------------------------------------------------------
// Last-resort handlers: log the fault, then converge on the same graceful
// shutdown path with a non-zero exit code.
process.on('uncaughtException', (err) => {
  log('ERROR', `Uncaught exception: ${err && err.stack ? err.stack : err}`);
  shutdown(1, 'uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  const detail = reason && reason.stack ? reason.stack : reason;
  log('ERROR', `Unhandled promise rejection: ${detail}`);
  shutdown(1, 'unhandledRejection');
});

// Termination signals trigger a clean, zero-exit shutdown.
process.on('SIGTERM', () => shutdown(0, 'SIGTERM'));
process.on('SIGINT', () => shutdown(0, 'SIGINT'));

// ---------------------------------------------------------------------------
// Start listening (startup log preserved verbatim)
// ---------------------------------------------------------------------------
server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});
