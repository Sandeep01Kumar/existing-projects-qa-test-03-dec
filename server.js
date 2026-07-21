const http = require('http');

// ---------------------------------------------------------------------------
// Configuration constants
// ---------------------------------------------------------------------------
// HTTP method allowlist. GET drives the documented success path; HEAD is its
// conventional companion (identical headers, no body). Anything else -> 405.
const ALLOWED_METHODS = new Set(['GET', 'HEAD']);
const ALLOW_HEADER = [...ALLOWED_METHODS].join(', ');

// The preserved success-path response body and its byte length. The length (14)
// is sent as Content-Length for BOTH GET and HEAD so the two share identical
// representation headers; HEAD omits only the body itself, per HTTP semantics.
const HELLO_BODY = 'Hello, World!\n';
const HELLO_BODY_LENGTH = Buffer.byteLength(HELLO_BODY);

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

// Idempotency guard so the shutdown routine executes teardown exactly once.
let shuttingDown = false;

// Final process exit code. It escalates monotonically from 0 (clean) to a
// non-zero (fatal) value and can NEVER be lowered again. This guarantees that a
// fatal event occurring AFTER a clean signal shutdown has already begun cannot
// be masked as a successful (exit 0) termination.
let finalExitCode = 0;

// Monotonically escalate the final exit code. It only ever raises the code
// (0 -> non-zero, or to a larger value); it never lowers an already-escalated
// fatal code. Every shutdown entry point funnels its requested code through
// this so the highest-severity outcome always wins, regardless of ordering.
const escalateExitCode = (code) => {
  if (typeof code === 'number' && code > finalExitCode) {
    finalExitCode = code;
  }
};

// ---------------------------------------------------------------------------
// Helpers: safe, structured logging
// ---------------------------------------------------------------------------
// Upper bound on the length of any single sanitized log field. Bounds the size
// of a log line so a hostile client cannot emit unbounded log volume from one
// oversized value.
const MAX_LOG_FIELD_LENGTH = 256;

// Sanitize an arbitrary value for safe inclusion in a log line. Control
// characters (C0 range U+0000-001F and DEL/C1 range U+007F-009F) are escaped to
// a "\xHH" form so that CR/LF or terminal escape sequences embedded in
// untrusted input (URLs, headers, rejection reasons) can neither forge
// additional log lines nor inject terminal escape codes. The result is
// length-bounded to MAX_LOG_FIELD_LENGTH.
const sanitizeLogValue = (value) => {
  let str;
  if (typeof value === 'string') {
    str = value;
  } else if (value === null) {
    str = 'null';
  } else if (value === undefined) {
    str = 'undefined';
  } else {
    try {
      str = String(value);
    } catch (_conversionErr) {
      str = '[unstringifiable]';
    }
  }
  const escaped = str.replace(
    /[\u0000-\u001F\u007F-\u009F]/g,
    (ch) => `\\x${ch.charCodeAt(0).toString(16).padStart(2, '0')}`
  );
  return escaped.length > MAX_LOG_FIELD_LENGTH
    ? `${escaped.slice(0, MAX_LOG_FIELD_LENGTH)}...[truncated]`
    : escaped;
};

// Format an error for logging using ONLY its safe, non-sensitive fields: name,
// code, and message. The stack trace is deliberately never logged because it
// leaks absolute filesystem paths and internal structure. All fields are
// sanitized and length-bounded via sanitizeLogValue.
const formatError = (err) => {
  if (err && typeof err === 'object') {
    const name = sanitizeLogValue(err.name || 'Error');
    const code = err.code !== undefined ? ` code=${sanitizeLogValue(err.code)}` : '';
    const message = sanitizeLogValue(err.message || '');
    return `${name}${code}: ${message}`;
  }
  return sanitizeLogValue(err);
};

// Lightweight, dependency-free structured logger, preserving the existing
// template-literal style. Format: "[ISO-8601 timestamp] [LEVEL] message".
// WARN and ERROR are written to stderr; everything else to stdout. Callers must
// sanitize any untrusted values they interpolate into `message` using
// sanitizeLogValue / formatError / safeRequestTarget.
const log = (level, message) => {
  const line = `[${new Date().toISOString()}] [${level}] ${message}`;
  if (level === 'ERROR' || level === 'WARN') {
    console.error(line);
  } else {
    console.log(line);
  }
};

// Derive a safe, log-friendly request target from a raw request URL: the
// pathname only, control-escaped and length-bounded. The query string is
// intentionally dropped (its presence noted generically as "?<redacted>")
// because it commonly carries secrets such as tokens and API keys.
const safeRequestTarget = (rawUrl) => {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
    return sanitizeLogValue(rawUrl);
  }
  try {
    // A fixed, local base is sufficient to extract the pathname; the authority
    // is irrelevant and is never logged.
    const parsed = new URL(rawUrl, 'http://localhost');
    return `${sanitizeLogValue(parsed.pathname)}${parsed.search ? '?<redacted>' : ''}`;
  } catch (_parseErr) {
    // Unparseable target: strip any query portion, then sanitize what remains.
    const queryIndex = rawUrl.indexOf('?');
    const pathOnly = queryIndex === -1 ? rawUrl : rawUrl.slice(0, queryIndex);
    return `${sanitizeLogValue(pathOnly)}${queryIndex === -1 ? '' : '?<redacted>'}`;
  }
};

// ---------------------------------------------------------------------------
// Configuration: validated host/port binding
// ---------------------------------------------------------------------------
// The binding contract is preserved: host/port default to 127.0.0.1/3000 so
// existing verification workflows are unaffected. Optional environment
// overrides are honored, but a SUPPLIED override is strictly validated before
// use; an invalid value fails fast (non-zero) with a fixed, sanitized
// diagnostic rather than being silently accepted or crashing late during
// listen. An UNSET override always falls back to the documented default.
//
// These validators run before the server exists and before any socket is
// bound, so an invalid value is a pure configuration fault. process.exit(1) is
// the correct fail-fast here: there are no resources to tear down, and the
// runtime shutdown coordinator governs server/runtime faults, not startup
// configuration.
const resolveHost = () => {
  const raw = process.env.HOST;
  if (raw === undefined) {
    return '127.0.0.1';
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    log(
      'ERROR',
      'Invalid HOST: value is empty after trimming. Provide a non-empty host or unset HOST to use the default (127.0.0.1).'
    );
    process.exit(1);
  }
  return trimmed;
};

const resolvePort = () => {
  const raw = process.env.PORT;
  if (raw === undefined) {
    return 3000;
  }
  const trimmed = raw.trim();
  // Require a canonical base-10 integer: digits only, with no sign, decimal
  // point, whitespace, or other characters that Node's listen() would otherwise
  // misinterpret (a non-numeric string is treated as a pipe/path).
  if (!/^\d+$/.test(trimmed)) {
    log(
      'ERROR',
      `Invalid PORT: "${sanitizeLogValue(raw)}" is not a positive integer. Provide an integer between 1 and 65535 or unset PORT to use the default (3000).`
    );
    process.exit(1);
  }
  const port = Number(trimmed);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    log(
      'ERROR',
      `Invalid PORT: "${sanitizeLogValue(raw)}" is out of range. Provide an integer between 1 and 65535 or unset PORT to use the default (3000).`
    );
    process.exit(1);
  }
  return port;
};

const HOST = resolveHost();
const PORT = resolvePort();

// ---------------------------------------------------------------------------
// Helpers: guarded response writes
// ---------------------------------------------------------------------------
// Complete "can a response still be written?" predicate. A response may only be
// started when: headers have not been sent, the writable side has not ended,
// the response is not destroyed, it is still writable, and the underlying
// socket exists and is not destroyed. This covers the full set of terminal
// stream states so a write is never attempted on a dead or finished response.
const canWrite = (res) => {
  return (
    !res.headersSent &&
    !res.writableEnded &&
    !res.destroyed &&
    res.writable &&
    !!res.socket &&
    !res.socket.destroyed
  );
};

// Security response headers applied to EVERY response, across all status
// classes (200 / 400 / 404 / 405 / 413 / 500 and the parser-level clientError
// 400 below). These are cheap, dependency-free, defense-in-depth headers:
//   - X-Content-Type-Options: nosniff -> disables MIME-type sniffing so a
//     response is always interpreted as its declared Content-Type.
//   - X-Frame-Options: DENY           -> forbids framing (clickjacking
//     protection). Applied uniformly even though this service returns only
//     text/plain, so the guarantee holds on every response path.
// They do NOT alter the preserved GET / success contract: the status code,
// Content-Type, Content-Length, and body are unchanged; only these additional
// headers are added.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

// Guarded response writer used for EVERY response (the 200/HEAD success path
// included). It never writes twice and never writes to a finished or destroyed
// response: if canWrite() is false it silently no-ops, preventing "headers
// already sent" and write-after-end crashes. Any synchronous write failure is
// caught and logged safely rather than escalating into an uncaught exception,
// and the underlying socket is then released so a failed exchange never
// lingers until the socket timeout fires.
const safelyRespond = (res, statusCode, body, headers) => {
  if (!canWrite(res)) {
    return false;
  }
  try {
    res.statusCode = statusCode;
    // Apply the constant security headers to every response first, then any
    // caller-supplied headers (Content-Type, Content-Length, Allow,
    // Connection, ...). Header names are distinct, so ordering is immaterial.
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      res.setHeader(name, value);
    }
    if (headers) {
      for (const [name, value] of Object.entries(headers)) {
        res.setHeader(name, value);
      }
    }
    res.end(body);
    return true;
  } catch (writeErr) {
    log('ERROR', `Failed to write ${statusCode} response: ${formatError(writeErr)}`);
    // The response could not be written (for example an internal failure while
    // sending headers). Release the underlying socket immediately rather than
    // leaving it to linger until the socket timeout (server.timeout) fires, so
    // the failed exchange does not retain a connection. Guarded so an absent or
    // already-destroyed socket is left untouched (no double-destroy), mirroring
    // the reject() socket-release idiom used elsewhere.
    const socket = res.socket;
    if (socket && !socket.destroyed) {
      socket.destroy();
    }
    return false;
  }
};

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------
// Every request flows through validation gates (method -> URL -> body) before a
// differentiated response is produced. Resilience is layered around a single
// idempotent per-request terminal guard, terminate(), that coordinates the
// data/end/error/aborted/close paths so races converge on ONE place. Every
// response (the 200/HEAD success path included) is written through the guarded
// safelyRespond writer, and both the synchronous handler body and the
// asynchronous 'end' routing carry their own try/catch with a guarded 500.
const requestHandler = (req, res) => {
  // Running count of received body bytes (content is never retained; only the
  // length is measured) so an oversized body can be rejected in O(1) memory.
  let bodyBytes = 0;

  // One-way terminal guard for this request/response exchange. The FIRST caller
  // "wins"; every later data/end/error/aborted/close event becomes a no-op.
  // This is the single coordination point that prevents duplicate responses,
  // duplicate or inaccurate log lines, and writes to a dead socket under
  // abort/error/oversize races.
  let terminated = false;
  const terminate = () => {
    if (terminated) {
      return false;
    }
    terminated = true;
    return true;
  };

  // Common rejection path for pre-body validation failures (405 / 400 / declared
  // 413). Because the request body has NOT been consumed, an unread or slow body
  // could otherwise keep a keep-alive socket open until a timeout; so we set
  // "Connection: close" and, once the rejection response has been flushed,
  // deterministically release the socket. This drains/releases input rather than
  // lingering.
  const reject = (statusCode, body, headers) => {
    if (!terminate()) {
      return;
    }
    const wrote = safelyRespond(res, statusCode, body, {
      ...headers,
      Connection: 'close',
    });
    const releaseSocket = () => {
      const socket = res.socket;
      if (socket && !socket.destroyed) {
        socket.destroy();
      }
    };
    if (wrote) {
      // Release only AFTER the rejection bytes have been flushed to the socket,
      // so the client still receives the complete response.
      res.on('finish', releaseSocket);
    } else {
      releaseSocket();
    }
  };

  // Structured request logging once the response is flushed. The method is
  // sanitized and only the pathname is logged (the query string is dropped) so
  // that secrets and control characters can never reach the log.
  res.on('finish', () => {
    log(
      'INFO',
      `${sanitizeLogValue(req.method)} ${safeRequestTarget(req.url)} -> ${res.statusCode}`
    );
  });

  // Stream-level fault / termination listeners. Each routes through terminate()
  // so exactly one terminal action (and at most one log line) is produced,
  // regardless of the order in which faults and completions arrive.
  req.on('error', (err) => {
    if (terminate()) {
      log('ERROR', `Request stream error: ${formatError(err)}`);
      safelyRespond(res, 400, 'Bad Request\n', {
        'Content-Type': 'text/plain',
        Connection: 'close',
      });
    }
  });
  req.on('aborted', () => {
    if (terminate()) {
      log(
        'WARN',
        `Request aborted by client: ${sanitizeLogValue(req.method)} ${safeRequestTarget(req.url)}`
      );
    }
  });
  res.on('error', (err) => {
    // A response-side fault: record it once and mark terminal so nothing else
    // attempts to write on the dead socket.
    if (terminate()) {
      log('ERROR', `Response stream error: ${formatError(err)}`);
    }
  });
  res.on('close', () => {
    // Socket closed (possibly before the response finished): mark terminal so
    // no later path attempts a write.
    terminate();
  });

  try {
    // (1) Method allowlist -> 405 Method Not Allowed (with Allow header).
    if (!ALLOWED_METHODS.has(req.method)) {
      reject(405, 'Method Not Allowed\n', {
        'Content-Type': 'text/plain',
        Allow: ALLOW_HEADER,
      });
      return;
    }

    // (2) URL presence + length pre-check -> 400 Bad Request. An empty target is
    // rejected explicitly: the defensive contract does not accept an empty URL
    // (which would otherwise resolve against the base to "/").
    if (
      typeof req.url !== 'string' ||
      req.url.length === 0 ||
      req.url.length > MAX_URL_LENGTH
    ) {
      reject(400, 'Bad Request\n', { 'Content-Type': 'text/plain' });
      return;
    }

    // (2b) Safe URL parse via the global WHATWG URL constructor -> 400 on
    // failure. A base derived from the Host header lets relative request targets
    // (e.g. "/") parse correctly. Only the sanitized pathname is ever logged.
    let parsed;
    try {
      parsed = new URL(req.url, `http://${req.headers.host || HOST}`);
    } catch (parseErr) {
      log(
        'ERROR',
        `Malformed request URL ${safeRequestTarget(req.url)}: ${formatError(parseErr)}`
      );
      reject(400, 'Bad Request\n', { 'Content-Type': 'text/plain' });
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
      reject(413, 'Payload Too Large\n', { 'Content-Type': 'text/plain' });
      return;
    }

    // (3b) Streaming fallback: for chunked / unknown-length bodies, accumulate
    // chunk *lengths* (never the content) and reject once the running total
    // exceeds the cap. Attaching the 'data' listener also switches the request
    // into flowing mode, so 'end' fires even for bodiless GET/HEAD requests and
    // advances the flow to routing.
    //
    // On exceed we mark terminal, pause reading (applying TCP backpressure so no
    // more of the body is buffered), and respond 413 with "Connection: close" so
    // Node flushes the response and then closes the socket. We deliberately do
    // NOT destroy() the shared request/response socket here: an immediate
    // destroy() emits a TCP RST that discards the still-queued 413 bytes
    // (observed as a client-side ECONNRESET) and suppresses the response's
    // 'finish' event. Pausing plus "Connection: close" fulfils the same
    // resource-protection intent (stop consuming, release the socket) while
    // still emitting a complete 413.
    req.on('data', (chunk) => {
      if (terminated) {
        return;
      }
      bodyBytes += chunk.length;
      if (bodyBytes > MAX_BODY_SIZE) {
        if (terminate()) {
          req.pause();
          safelyRespond(res, 413, 'Payload Too Large\n', {
            'Content-Type': 'text/plain',
            Connection: 'close',
          });
        }
      }
    });

    req.on('end', () => {
      // Claim terminal state for the routing response. If an abort/error/oversize
      // already fired, terminate() returns false and routing is skipped.
      if (!terminate()) {
        return;
      }
      try {
        // (4) Routing / differentiated responses (post-validation). Every branch
        // is written through safelyRespond, which guards the write with the
        // complete canWrite() predicate.
        if (parsed.pathname === '/') {
          // Preserve the documented success contract byte-for-byte for GET, and
          // give HEAD the IDENTICAL representation headers (Content-Type and
          // Content-Length: 14) with no body, per HTTP semantics.
          const headers = {
            'Content-Type': 'text/plain',
            'Content-Length': HELLO_BODY_LENGTH,
          };
          safelyRespond(
            res,
            200,
            req.method === 'HEAD' ? undefined : HELLO_BODY,
            headers
          );
        } else {
          safelyRespond(res, 404, 'Not Found\n', { 'Content-Type': 'text/plain' });
        }
      } catch (routeErr) {
        // (5) Guarded 500 for faults raised while routing.
        log('ERROR', `Routing failure: ${formatError(routeErr)}`);
        safelyRespond(res, 500, 'Internal Server Error\n', {
          'Content-Type': 'text/plain',
        });
      }
    });
  } catch (err) {
    // (5) Last-resort per-request guard -> 500, guarded against double-write.
    log('ERROR', `Unhandled request error: ${formatError(err)}`);
    safelyRespond(res, 500, 'Internal Server Error\n', {
      'Content-Type': 'text/plain',
    });
  }
};

// ---------------------------------------------------------------------------
// Server construction and resilience
// ---------------------------------------------------------------------------
const server = http.createServer(requestHandler);

// Parser-level client errors (malformed request line, oversized headers, or an
// over-limit request URL) are emitted here BEFORE the request handler runs, so
// the normal 400 path in the handler never sees them. Map them to a minimal,
// safe 400 response and release the socket, rather than letting Node emit its
// default (for example a 431 for header/URL overflow). Node provides the raw
// socket: only write when it is still writable and nothing has been sent yet;
// otherwise destroy it (avoiding a duplicate response when a partial reply was
// already written). A single sanitized log line records the outcome.
server.on('clientError', (err, socket) => {
  const code = err && err.code ? sanitizeLogValue(err.code) : 'unknown';
  log('WARN', `Client protocol error (${code}); responding 400 and closing the socket.`);
  if (!socket || socket.destroyed || !socket.writable) {
    if (socket && !socket.destroyed) {
      socket.destroy();
    }
    return;
  }
  if (socket.bytesWritten > 0) {
    // A response was already (partially) written on this socket; do not attempt
    // a second one.
    socket.destroy();
    return;
  }
  // Mirror the security headers that safelyRespond adds to every application
  // response so this parser-level 400 path carries identical defense-in-depth
  // headers. Content-Length stays 12: the "Bad Request\n" body is unchanged;
  // the two added lines are response headers, not body bytes.
  socket.end(
    'HTTP/1.1 400 Bad Request\r\n' +
      'Content-Type: text/plain\r\n' +
      'X-Content-Type-Options: nosniff\r\n' +
      'X-Frame-Options: DENY\r\n' +
      'Connection: close\r\n' +
      'Content-Length: 12\r\n' +
      '\r\n' +
      'Bad Request\n'
  );
});

// ---------------------------------------------------------------------------
// Graceful shutdown (idempotent)
// ---------------------------------------------------------------------------
// A single teardown path shared by termination signals and fatal-error
// handlers: stop accepting connections, drain in-flight requests, release
// sockets and timers, then exit. A forced-exit timer guarantees termination
// even if draining hangs. Defined before the handlers that reference it so
// there are no forward references.
const shutdown = (exitCode = 0, signalOrReason) => {
  // Escalate the process exit code on EVERY call — including a re-entrant one
  // that arrives while teardown is already running. This is what makes a fatal
  // fault occurring AFTER a clean signal (for example SIGTERM followed by an
  // uncaughtException) still force a non-zero exit: finalExitCode only ever
  // rises from 0 toward a fatal value and is never lowered again.
  escalateExitCode(exitCode);

  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  log(
    'INFO',
    `Shutdown initiated (${signalOrReason || 'manual'}); no longer accepting connections.`
  );

  // If the server never began listening (for example a bind failure such as
  // EADDRINUSE/EACCES surfaced before listen() succeeded), there is nothing to
  // close and nothing to drain. Release any tracked sockets and exit promptly
  // rather than calling server.close() on a server that is not running (which
  // would emit a redundant "Server is not running" error). The full graceful
  // drain lives in the else branch, so there is no fall-through and no
  // unreachable statement after the terminal process.exit().
  if (!server.listening) {
    for (const socket of connections) {
      socket.destroy();
    }
    log('INFO', 'Server was not listening; exiting without draining connections.');
    process.exit(finalExitCode);
  } else {
    // Tracks whether lingering sockets had to be forcibly terminated by the
    // drain timer, so the completion log accurately reports a forced close
    // rather than claiming a clean drain.
    let forcedClose = false;

    // Backstop: force exit if graceful drain exceeds the allotted window. The
    // timer is unref'd so it never keeps the event loop alive on its own. A
    // forced hard-exit is itself abnormal, so escalate to a non-zero code.
    const forceTimer = setTimeout(() => {
      log('ERROR', `Graceful shutdown exceeded ${SHUTDOWN_TIMEOUT}ms; forcing exit.`);
      for (const socket of connections) {
        socket.destroy();
      }
      escalateExitCode(1);
      process.exit(finalExitCode);
    }, SHUTDOWN_TIMEOUT);
    forceTimer.unref();

    // After a short grace period for in-flight requests, forcibly close any
    // sockets still lingering (e.g. slow keep-alive clients). Also unref'd.
    const drainTimer = setTimeout(() => {
      forcedClose = true;
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      for (const socket of connections) {
        socket.destroy();
      }
    }, DRAIN_GRACE);
    drainTimer.unref();

    // Stop accepting new connections; exit once existing ones have drained.
    // Every terminal branch reads the module-level finalExitCode so an
    // escalated fatal code is always honored (see #1), and the completion log
    // distinguishes a clean drain from a forced close (see #9).
    server.close((err) => {
      clearTimeout(forceTimer);
      clearTimeout(drainTimer);
      if (err) {
        log('ERROR', `Error while closing server: ${formatError(err)}`);
        escalateExitCode(1);
        process.exit(finalExitCode);
      } else if (forcedClose) {
        log('WARN', 'Server closed after forcibly terminating lingering connection(s).');
        process.exit(finalExitCode);
      } else {
        log('INFO', 'All connections drained; process exiting cleanly.');
        process.exit(finalExitCode);
      }
    });

    // Release idle keep-alive sockets immediately so draining completes fast.
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }
  }
};

// Listen failures are fatal: the server cannot start, so log an actionable
// message and exit non-zero instead of crashing with an unhandled error.
server.on('error', (err) => {
  // All server-level errors — including bind failures that occur before the
  // server is listening — converge on the shared shutdown() coordinator with a
  // fatal exit code, rather than calling process.exit() directly. shutdown()
  // detects the not-listening state and exits promptly without an invalid
  // server.close(). HOST is sanitized and the error is formatted with
  // formatError so no control characters or stack traces reach the log.
  if (err.code === 'EADDRINUSE') {
    log(
      'ERROR',
      `Address already in use: ${sanitizeLogValue(HOST)}:${PORT} (EADDRINUSE). Is another instance running?`
    );
    shutdown(1, 'server-error:EADDRINUSE');
  } else if (err.code === 'EACCES') {
    log(
      'ERROR',
      `Permission denied binding ${sanitizeLogValue(HOST)}:${PORT} (EACCES). Try an unprivileged port.`
    );
    shutdown(1, 'server-error:EACCES');
  } else {
    log('ERROR', `Server error: ${formatError(err)}`);
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
  // Log ONLY the safe fields (never the stack trace, which would leak absolute
  // filesystem paths and internal structure) and converge on the shared
  // teardown path with a fatal exit code.
  log('ERROR', `Uncaught exception: ${formatError(err)}`);
  shutdown(1, 'uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  // A rejection reason can be any value (an Error, string, number, or object).
  // formatError extracts safe fields for Error objects and safely stringifies
  // any other value, and never emits a stack trace.
  log('ERROR', `Unhandled promise rejection: ${formatError(reason)}`);
  shutdown(1, 'unhandledRejection');
});

// Termination signals trigger a clean, zero-exit shutdown.
process.on('SIGTERM', () => shutdown(0, 'SIGTERM'));
process.on('SIGINT', () => shutdown(0, 'SIGINT'));

// ---------------------------------------------------------------------------
// Start listening (startup log preserved verbatim)
// ---------------------------------------------------------------------------
server.listen(PORT, HOST, () => {
  // Startup log preserved verbatim for the default binding. HOST is sanitized
  // defensively so that a control character in an override could not forge an
  // additional log line; for the default 127.0.0.1 the output is byte-for-byte
  // identical to the documented baseline.
  console.log(`Server running at http://${sanitizeLogValue(HOST)}:${PORT}/`);
});
