// Runs the bundled action (dist/index.js) the way the runner does: a fresh
// Node process with INPUT_* and GITHUB_* environment variables.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function runAction({ apiUrl, inputs = {}, event, env = {} }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'action-test-'));
  const outputFile = path.join(tmp, 'github_output');
  const stateFile = path.join(tmp, 'github_state');
  fs.writeFileSync(outputFile, '');
  fs.writeFileSync(stateFile, '');
  const childEnv = {
    PATH: process.env.PATH,
    GITHUB_API_URL: apiUrl,
    GITHUB_OUTPUT: outputFile,
    GITHUB_STATE: stateFile,
    GITHUB_REPOSITORY: 'octo-org/hello-world',
    ...env
  };
  if (event) {
    const eventPath = path.join(tmp, 'event.json');
    fs.writeFileSync(eventPath, JSON.stringify(event));
    childEnv.GITHUB_EVENT_PATH = eventPath;
  }
  for (const [name, value] of Object.entries(inputs)) {
    childEnv[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] = value;
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'dist', 'index.js')], {
      env: childEnv
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => (stdout += d));
    child.stderr.on('data', d => (stderr += d));
    child.on('error', reject);
    child.on('close', code =>
      resolve({
        code,
        stdout,
        stderr,
        output: fs.readFileSync(outputFile, 'utf8'),
        state: fs.readFileSync(stateFile, 'utf8')
      })
    );
  });
}
