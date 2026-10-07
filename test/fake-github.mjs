// A tiny stand-in for the GitHub REST API, used to test the bundled action
// end to end (point GITHUB_API_URL at it). It records every request and
// answers the two label endpoints the way api.github.com does. Labels listed
// in `missing` answer 404 on DELETE, like a label that is not on the issue.
import http from 'node:http';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function startFakeGitHub({
  missing = [],
  failAdd = false,
  port = 0,
  host = '127.0.0.1',
  logFile
} = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const url = new URL(req.url, 'http://localhost');
      const entry = {
        method: req.method,
        path: url.pathname,
        authorization: req.headers.authorization,
        body: body ? JSON.parse(body) : undefined
      };
      requests.push(entry);
      if (logFile) fs.writeFileSync(logFile, JSON.stringify(requests, null, 2));
      const send = (status, payload) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      const issue = '^/repos/([^/]+)/([^/]+)/issues/(\\d+)/labels';
      const add = url.pathname.match(new RegExp(issue + '$'));
      const del = url.pathname.match(new RegExp(issue + '/([^/]+)$'));
      if (req.method === 'POST' && add) {
        if (failAdd) {
          return send(403, { message: 'Resource not accessible by integration' });
        }
        const labels = (entry.body?.labels ?? []).map((name, i) => ({ id: i + 1, name }));
        return send(200, labels);
      }
      if (req.method === 'DELETE' && del) {
        if (missing.includes(decodeURIComponent(del[4]))) {
          return send(404, { message: 'Label does not exist' });
        }
        return send(200, []);
      }
      send(404, { message: 'Not Found' });
    });
  });
  return new Promise(resolve => {
    server.listen(port, host, () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        requests,
        close: () => new Promise(r => server.close(r))
      });
    });
  });
}

// Standalone (used for the act run):
//   FAKE_MISSING=a,b node test/fake-github.mjs 8765 requests.json
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const missing = (process.env.FAKE_MISSING || '').split(',').filter(Boolean);
  const port = Number(process.argv[2] || 8765);
  const fake = await startFakeGitHub({ missing, port, host: '0.0.0.0', logFile: process.argv[3] });
  console.log(`fake GitHub API listening on ${fake.url}`);
}
