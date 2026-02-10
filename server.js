/**
 * Production-Ready Node.js HTTP Server
 *
 * Features:
 * - Comprehensive error handling (server, client, request, response)
 * - Graceful shutdown with SIGTERM/SIGINT signal handling
 * - HTTP method validation (GET, HEAD, OPTIONS only)
 * - Path validation with proper 404 responses
 * - Resource cleanup on shutdown with forced exit timeout
 * - Client error handling for malformed requests
 * - Process-level error handlers for uncaught exceptions and unhandled rejections
 */

const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

/** Flag to track whether the server is in the process of shutting down */
let isShuttingDown = false;

const server = http.createServer((req, res) => {
  // During shutdown, reject new requests with 503 Service Unavailable
  if (isShuttingDown) {
    res.writeHead(503, {
      'Content-Type': 'text/plain',
      'Connection': 'close',
      'Retry-After': '30'
    });
    res.end('Service Unavailable\n');
    return;
  }

  // Fix #5: Request stream error handler to prevent crashes from aborted connections
  req.on('error', (err) => {
    console.error('Request stream error:', err.message);
    if (!res.headersSent) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad Request\n');
    }
  });

  // Fix #5: Response stream error handler to prevent crashes from write-after-end errors
  res.on('error', (err) => {
    console.error('Response stream error:', err.message);
  });

  // Fix #4: HTTP method validation - only allow GET, HEAD, and OPTIONS
  const allowedMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (!allowedMethods.includes(req.method)) {
    res.writeHead(405, {
      'Content-Type': 'text/plain',
      'Allow': allowedMethods.join(', ')
    });
    res.end('Method Not Allowed\n');
    return;
  }

  // Fix #4: Handle OPTIONS requests with proper Allow header and 204 No Content
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Allow': allowedMethods.join(', '),
      'Content-Length': '0'
    });
    res.end();
    return;
  }

  // Fix #4: Path validation - only root path is valid
  if (req.url !== '/' && req.url !== '') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found\n');
    return;
  }

  // Successful response for valid GET/HEAD requests to root path
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

// Fix #1: Server error handler for infrastructure-level errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please choose a different port or stop the other process.`);
    process.exit(1);
  } else if (err.code === 'EACCES') {
    console.error(`Permission denied to bind to port ${port}. Try a port above 1024 or run with elevated privileges.`);
    process.exit(1);
  } else {
    console.error('Server error:', err.message);
    process.exit(1);
  }
});

// Fix #2: Client error handler for malformed requests and connection-level failures
server.on('clientError', (err, socket) => {
  console.error('Client error:', err.message);
  if (socket.writable) {
    if (err.code === 'HPE_HEADER_OVERFLOW') {
      socket.end('HTTP/1.1 431 Request Header Fields Too Large\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nRequest Header Fields Too Large\n');
    } else {
      socket.end('HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nBad Request\n');
    }
  } else {
    socket.destroy();
  }
});

/**
 * Initiates graceful server shutdown.
 * Stops accepting new connections, waits for existing requests to complete,
 * and forces exit after a 10-second timeout if connections linger.
 *
 * @param {string} signal - The signal that triggered the shutdown (e.g., 'SIGTERM', 'SIGINT')
 */
function gracefulShutdown(signal) {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    console.log('Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  console.log(`${signal} signal received: starting graceful shutdown`);

  // Set a forced shutdown timeout to prevent hanging on lingering connections
  const forceShutdownTimeout = setTimeout(() => {
    console.error('Forced shutdown: could not close connections in time');
    process.exit(1);
  }, 10000);

  // Prevent the timeout from keeping the process alive if server closes normally
  forceShutdownTimeout.unref();

  // Stop accepting new connections and close existing idle connections
  server.close((err) => {
    if (err) {
      console.error('Error during server close:', err.message);
      process.exit(1);
    }
    console.log('HTTP server closed successfully');
    clearTimeout(forceShutdownTimeout);
    process.exit(0);
  });
}

// Fix #3: Process signal handlers for graceful shutdown
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});

// Process-level error handlers to catch unhandled failures
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
  console.error(err.stack);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
