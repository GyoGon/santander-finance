// Floid Open Banking client for Santander Chile (Personas)
// API docs: https://readme.floid.io (requires Floid account)
// Endpoint paths may need adjustment once you have your Floid API key and verify the docs.

const http = require('http');
const { getAuthHeader } = require('./auth');

const BASE_URL = process.env.FLOID_BASE_URL || 'https://api.floid.app';
const CALLBACK_PORT = parseInt(process.env.FLOID_CALLBACK_PORT || '8767', 10);
const CALLBACK_HOST = process.env.FLOID_CALLBACK_HOST || 'http://localhost';

async function fetchJson(url, body) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Floid API error ${res.status} on ${url}: ${text}`);
  }
  return res.json();
}

// Starts a temporary local HTTP server that waits for ONE callback from Floid
function waitForCallback(timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== 'POST') { res.end(); return; }
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        res.writeHead(200);
        res.end('ok');
        server.close();
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Invalid JSON in callback: ' + body)); }
      });
    });
    server.listen(CALLBACK_PORT, () => {
      console.log(`  Waiting for Floid callback on port ${CALLBACK_PORT}...`);
    });
    setTimeout(() => {
      server.close();
      reject(new Error(`Floid callback timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

async function getProducts(rut, clave) {
  const callbackUrl = `${CALLBACK_HOST}:${CALLBACK_PORT}/floid-callback`;
  const cbPromise = waitForCallback();
  await fetchJson(`${BASE_URL}/cl/transactions/santander/persona/products`, { rut, clave, callbackUrl });
  return cbPromise;
}

async function getCardTransactions(rut, clave) {
  const callbackUrl = `${CALLBACK_HOST}:${CALLBACK_PORT}/floid-callback`;
  const cbPromise = waitForCallback();
  await fetchJson(`${BASE_URL}/cl/transactions/santander/persona/credit-card`, { rut, clave, callbackUrl });
  return cbPromise;
}

async function getAccountTransactions(rut, clave) {
  const callbackUrl = `${CALLBACK_HOST}:${CALLBACK_PORT}/floid-callback`;
  const cbPromise = waitForCallback();
  await fetchJson(`${BASE_URL}/cl/transactions/santander/persona/transactions`, { rut, clave, callbackUrl });
  return cbPromise;
}

module.exports = { getProducts, getCardTransactions, getAccountTransactions };
