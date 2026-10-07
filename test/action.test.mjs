import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { startFakeGitHub } from './fake-github.mjs';
import { runAction } from './run-action.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function assertNoDeprecatedCommands(result) {
  assert.doesNotMatch(result.stdout, /::set-output/);
  assert.doesNotMatch(result.stdout, /::save-state/);
  // No Node deprecation warnings (the old bundle printed DEP0169 for url.parse).
  assert.doesNotMatch(result.stderr, /DeprecationWarning/);
}

test('adds all labels with one POST to the issue labels endpoint', async () => {
  const api = await startFakeGitHub();
  try {
    const result = await runAction({
      apiUrl: api.url,
      inputs: {
        github_token: 'ghs_test_token',
        labels: 'bug\ngood first issue\n\nhelp wanted',
        repo: 'octo-org/hello-world',
        number: '42'
      }
    });
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.deepEqual(api.requests, [
      {
        method: 'POST',
        path: '/repos/octo-org/hello-world/issues/42/labels',
        authorization: 'token ghs_test_token',
        body: { labels: ['bug', 'good first issue', 'help wanted'] }
      }
    ]);
    assertNoDeprecatedCommands(result);
    assert.equal(result.output, '', 'the action declares no outputs');
  } finally {
    await api.close();
  }
});

test('takes the number from the triggering pull request when number is empty', async () => {
  const api = await startFakeGitHub();
  try {
    const result = await runAction({
      apiUrl: api.url,
      inputs: { github_token: 't', labels: 'size/S', repo: 'octo-org/hello-world', number: '' },
      event: { pull_request: { number: 314 } }
    });
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(api.requests.length, 1);
    assert.equal(api.requests[0].path, '/repos/octo-org/hello-world/issues/314/labels');
    assert.deepEqual(api.requests[0].body, { labels: ['size/S'] });
  } finally {
    await api.close();
  }
});

test('takes the number from the triggering issue when number is empty', async () => {
  const api = await startFakeGitHub();
  try {
    const result = await runAction({
      apiUrl: api.url,
      inputs: { github_token: 't', labels: 'triage', repo: 'someone/else' },
      event: { issue: { number: 9 } }
    });
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(api.requests[0].path, '/repos/someone/else/issues/9/labels');
  } finally {
    await api.close();
  }
});

test('makes no API call when labels is empty', async () => {
  const api = await startFakeGitHub();
  try {
    const result = await runAction({
      apiUrl: api.url,
      inputs: { github_token: 't', labels: '', repo: 'octo-org/hello-world', number: '1' }
    });
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.deepEqual(api.requests, []);
  } finally {
    await api.close();
  }
});

test('fails the step with the API error message when GitHub refuses', async () => {
  const api = await startFakeGitHub({ failAdd: true });
  try {
    const result = await runAction({
      apiUrl: api.url,
      inputs: { github_token: 't', labels: 'bug', repo: 'octo-org/hello-world', number: '1' }
    });
    assert.equal(result.code, 1);
    assert.match(result.stdout, /::error::.*Resource not accessible by integration/);
    assertNoDeprecatedCommands(result);
  } finally {
    await api.close();
  }
});

test('action.yml runs on node24 and keeps the upstream inputs unchanged', () => {
  const action = YAML.parse(fs.readFileSync(path.join(root, 'action.yml'), 'utf8'));
  assert.equal(action.runs.using, 'node24');
  assert.equal(action.runs.main, 'dist/index.js');
  assert.equal(action.name, '360 Bench Add Labels');
  // Inputs exactly as in actions-ecosystem/action-add-labels@v1.
  assert.deepEqual(action.inputs, {
    github_token: {
      description: 'A GitHub token.',
      required: false,
      default: '${{ github.token }}'
    },
    labels: {
      description:
        "The labels' name to be added. Must be separated with line breaks if there're multiple labels.",
      required: true
    },
    repo: {
      description: 'The owner and repository name. e.g.) Codertocat/Hello-World',
      required: false,
      default: '${{ github.repository }}'
    },
    number: {
      description: 'The number of the issue or pull request.',
      required: false
    }
  });
  assert.equal(action.outputs, undefined, 'upstream declares no outputs');
});
