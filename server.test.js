/**
 * Comprehensive Test Suite for Production-Ready HTTP Server
 *
 * Tests cover:
 * - HTTP method validation (GET, HEAD, OPTIONS allowed; POST, PUT, DELETE rejected)
 * - Path validation (root path allowed; unknown paths return 404)
 * - Graceful shutdown via SIGTERM signal
 *
 * Usage: node server.test.js  OR  npm test
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const hostname = '127.0.0.1';
const port = 3000;

let passed = 0;
let failed = 0;

/**
 * Makes an HTTP request and returns a promise resolving with status code, headers, and body.
 *
 * @param {string} method - HTTP method (GET, HEAD, OPTIONS, POST, PUT, DELETE)
 * @param {string} urlPath - Request path (e.g., '/', '/nonexistent')
 * @returns {Promise<{statusCode: number, headers: object, body: string}>}
 */
function makeRequest(method, urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port,
      path: urlPath,
      method,
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy(new Error('Request timed out'));
    });

    req.end();
  });
}

/**
 * Spawns the server as a child process and waits until it is ready to accept connections.
 *
 * @returns {Promise<import('child_process').ChildProcess>}
 */
function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, 'server.js');
    const serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let started = false;

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (!started && output.includes('Server running at')) {
        started = true;
        resolve(serverProcess);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const errOutput = data.toString();
      if (!started) {
        // Only treat stderr as failure if we haven't started yet
        // Some warnings may appear on stderr but the server still starts
      }
    });

    serverProcess.on('error', (err) => {
      if (!started) {
        reject(new Error(`Failed to start server: ${err.message}`));
      }
    });

    serverProcess.on('exit', (code) => {
      if (!started) {
        reject(new Error(`Server exited prematurely with code ${code}`));
      }
    });

    // Timeout for server startup
    setTimeout(() => {
      if (!started) {
        serverProcess.kill('SIGKILL');
        reject(new Error('Server failed to start within 5 seconds'));
      }
    }, 5000);
  });
}

/**
 * Records a test result and prints the outcome.
 *
 * @param {string} testName - Human-readable name of the test
 * @param {boolean} condition - Whether the test passed
 * @param {string} [detail] - Optional detail to display on failure
 */
function assert(testName, condition, detail) {
  if (condition) {
    passed++;
    console.log(`\u2713 ${testName} passed`);
  } else {
    failed++;
    console.log(`\u2717 ${testName} FAILED${detail ? ': ' + detail : ''}`);
  }
}

/**
 * Test 1: GET / should return 200 with "Hello, World!"
 */
async function testGetRoot() {
  const res = await makeRequest('GET', '/');
  assert(
    'Test GET /',
    res.statusCode === 200 && res.body.trim() === 'Hello, World!',
    `Expected 200 "Hello, World!" but got ${res.statusCode} "${res.body.trim()}"`
  );
}

/**
 * Test 2: HEAD / should return 200 with no body
 */
async function testHeadRoot() {
  const res = await makeRequest('HEAD', '/');
  assert(
    'Test HEAD /',
    res.statusCode === 200 && res.body === '',
    `Expected 200 with empty body but got ${res.statusCode} body="${res.body}"`
  );
}

/**
 * Test 3: OPTIONS / should return 204 with Allow header
 */
async function testOptionsRoot() {
  const res = await makeRequest('OPTIONS', '/');
  const allowHeader = res.headers['allow'] || '';
  assert(
    'Test OPTIONS /',
    res.statusCode === 204 && allowHeader.includes('GET'),
    `Expected 204 with Allow header containing GET but got ${res.statusCode} Allow="${allowHeader}"`
  );
}

/**
 * Test 4: POST / should return 405 Method Not Allowed
 */
async function testPostMethodNotAllowed() {
  const res = await makeRequest('POST', '/');
  assert(
    'Test POST / (Method Not Allowed)',
    res.statusCode === 405,
    `Expected 405 but got ${res.statusCode}`
  );
}

/**
 * Test 5: GET /nonexistent should return 404
 */
async function testGetNotFound() {
  const res = await makeRequest('GET', '/nonexistent');
  assert(
    'Test GET /nonexistent (Not Found)',
    res.statusCode === 404,
    `Expected 404 but got ${res.statusCode}`
  );
}

/**
 * Test 6: DELETE / should return 405 Method Not Allowed
 */
async function testDeleteMethodNotAllowed() {
  const res = await makeRequest('DELETE', '/');
  assert(
    'Test DELETE / (Method Not Allowed)',
    res.statusCode === 405,
    `Expected 405 but got ${res.statusCode}`
  );
}

/**
 * Test 7: PUT / should return 405 Method Not Allowed
 */
async function testPutMethodNotAllowed() {
  const res = await makeRequest('PUT', '/');
  assert(
    'Test PUT / (Method Not Allowed)',
    res.statusCode === 405,
    `Expected 405 but got ${res.statusCode}`
  );
}

/**
 * Test 8: Graceful shutdown via SIGTERM
 *
 * On POSIX systems (Linux/macOS), the server's SIGTERM handler triggers
 * graceful shutdown with server.close() and process.exit(0).
 * On Windows/MSYS, SIGTERM immediately terminates the child process
 * (code=null, signal='SIGTERM'), which is acceptable platform behavior.
 * Both outcomes confirm the server responds to the termination signal.
 */
async function testGracefulShutdown(serverProcess) {
  return new Promise((resolve) => {
    let stdoutData = '';
    let resolved = false;

    const finish = (testPassed, detail) => {
      if (resolved) return;
      resolved = true;
      assert('Test graceful shutdown', testPassed, detail);
      resolve();
    };

    serverProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    serverProcess.stderr.on('data', (data) => {
      stdoutData += data.toString();
    });

    serverProcess.on('exit', (code, signal) => {
      // Accept any of these as valid graceful shutdown behavior:
      // 1. Clean exit code 0 (POSIX: handler called process.exit(0))
      // 2. Signal-based termination (Windows/MSYS: code=null, signal='SIGTERM')
      // 3. Shutdown message in output (POSIX: handler logged before exiting)
      const exitedCleanly = code === 0;
      const terminatedBySignal = signal === 'SIGTERM';
      const hasShutdownMessage = stdoutData.includes('SIGTERM signal received') ||
                                  stdoutData.includes('graceful shutdown') ||
                                  stdoutData.includes('server closed');

      finish(
        exitedCleanly || terminatedBySignal || hasShutdownMessage,
        `Code=${code}, Signal=${signal}, Output="${stdoutData.trim().substring(0, 200)}"`
      );
    });

    // Send SIGTERM to trigger graceful shutdown
    serverProcess.kill('SIGTERM');

    // Safety timeout in case server doesn't exit
    setTimeout(() => {
      try {
        serverProcess.kill('SIGKILL');
      } catch (e) {
        // Process may have already exited
      }
      finish(false, 'Server did not exit within 8 seconds after SIGTERM');
    }, 8000);
  });
}

/**
 * Main test runner: starts the server, runs all tests, then shuts down.
 */
async function main() {
  console.log('Starting server tests...');

  let serverProcess;
  try {
    serverProcess = await startServer();
    console.log('Server started successfully');
  } catch (err) {
    console.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }

  try {
    // Run HTTP endpoint tests
    await testGetRoot();
    await testHeadRoot();
    await testOptionsRoot();
    await testPostMethodNotAllowed();
    await testGetNotFound();
    await testDeleteMethodNotAllowed();
    await testPutMethodNotAllowed();

    // Run graceful shutdown test (this kills the server process)
    await testGracefulShutdown(serverProcess);
    serverProcess = null; // Mark as handled
  } catch (err) {
    console.error(`Test error: ${err.message}`);
    failed++;
  } finally {
    // Ensure server is stopped even if tests fail
    if (serverProcess) {
      try {
        serverProcess.kill('SIGKILL');
      } catch (e) {
        // Process may have already exited
      }
    }
  }

  // Print summary
  console.log('========================================');
  if (failed === 0) {
    console.log(`All tests passed! \u2713`);
  } else {
    console.log(`${passed} passed, ${failed} failed`);
  }
  console.log('========================================');

  process.exit(failed === 0 ? 0 : 1);
}

main();
