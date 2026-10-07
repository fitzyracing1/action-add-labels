# 360 Bench Add Labels

> Part of **[360 Bench](https://github.com/fitzyracing1/360-bench)**, tested fixes for abandoned packages and actions.

![screenshot](./docs/assets/screenshot.png)

This is a GitHub Action to add GitHub labels to an issue or a pull request.

> **This is a fork of [actions-ecosystem/action-add-labels](https://github.com/actions-ecosystem/action-add-labels)
> by [The Actions Ecosystem Authors](https://github.com/actions-ecosystem)**, updated to run on
> Node 24. Upstream has not been released since v1.1.3 (August 2021), and its `@v1` still declares
> `using: node12`. All credit for the original action goes to its authors; it remains available
> under the same [Apache License 2.0](./LICENSE). See [NOTICE](./NOTICE) for what was changed.

## What's fixed in this fork

Based on upstream `main` at [`1a9c371`](https://github.com/actions-ecosystem/action-add-labels/commit/1a9c371)
(May 2023, never released). The inputs are the same, the action still has no outputs, and the
labels are added with the same single API call.

- **Runs on Node 24 (`using: node24`) instead of `node12`.** GitHub
  [removed Node 20 from Actions runners on 2026-09-23](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/)
  and now force-runs older JavaScript actions on Node 24, flagging every run with a deprecation
  warning. `node24` is the runtime GitHub currently documents for JavaScript actions.
  Upstream issues: [#459](https://github.com/actions-ecosystem/action-add-labels/issues/459),
  [#483](https://github.com/actions-ecosystem/action-add-labels/issues/483). Unmerged upstream PRs
  with the same idea: [#434](https://github.com/actions-ecosystem/action-add-labels/pull/434),
  [#477](https://github.com/actions-ecosystem/action-add-labels/pull/477) (node16) and
  [#480](https://github.com/actions-ecosystem/action-add-labels/pull/480) (node20).
- **Current `@actions/core` (3.x) and `@actions/github` (9.x), rebuilt with `ncc`.** The old bundle
  shipped `@actions/core` 1.2 (which only knows the deprecated `::set-output` / `::save-state`
  commands) and an Octokit that prints a Node `DEP0169` (`url.parse()`) deprecation warning on
  Node 24. The new bundle writes through `$GITHUB_OUTPUT` / `$GITHUB_STATE` when it needs to and
  prints no deprecation warnings.
- **Respects `GITHUB_API_URL`.** The released `@v1` sent requests to `https://api.github.com`
  no matter what; this build uses `getOctokit`, which follows the runner's `GITHUB_API_URL`
  (this was already on upstream `main`, just never released). On github.com nothing changes.

## How to switch

Replace the `uses:` line; nothing else changes:

```diff
-      - uses: actions-ecosystem/action-add-labels@v1
+      - uses: fitzyracing1/action-add-labels@v1
```

For the strictest setup, pin the full commit SHA of the release instead of `@v1`.

## Inputs

|      NAME      |                                           DESCRIPTION                                           |   TYPE   | REQUIRED |                                     DEFAULT                                     |
| -------------- | ----------------------------------------------------------------------------------------------- | -------- | -------- | ------------------------------------------------------------------------------- |
| `github_token` | A GitHub token.                                                                                 | `string` | `false`  | `${{ github.token }}`                                                           |
| `labels`       | The labels' name to be added. Must be separated with line breaks if there're multiple labels.   | `string` | `true`   | `N/A`                                                                           |
| `number`       | The number of the issue or pull request.                                                        | `number` | `false`  | `${{ github.event.issue.number }}` or `${{ github.event.pull_request.number }}` |
| `repo`         | The owner and repository name. e.g.) `Codertocat/Hello-World`                                   | `string` | `false`  | `${{ github.repository }}`                                                      |

(The `number` and `repo` defaults were swapped in the upstream table; this one matches `action.yml`.)

This action extracts the number from the issue or pull request that triggered it by default,
so you don't need to choose between `${{ github.event.issue.number }}` and
`${{ github.event.pull_request.number }}`. The token needs `issues: write` (for issues) or
`pull-requests: write` (for pull requests).

## Example

### Add a single label

```yaml
name: Add Label

on:
  issues:
    types: opened

permissions:
  issues: write

jobs:
  add_label:
    runs-on: ubuntu-latest
    steps:
      - name: add label
        uses: fitzyracing1/action-add-labels@v1
        with:
          labels: bug
```

### Add multiple labels with a comment

```yaml
name: Add Labels

on: [issue_comment]

permissions:
  issues: write
  pull-requests: write

jobs:
  add_labels:
    runs-on: ubuntu-latest
    steps:
      - name: add labels
        uses: fitzyracing1/action-add-labels@v1
        if: ${{ startsWith(github.event.comment.body, '/add-labels') }}
        with:
          labels: |
            documentation
            changelog
```

## Tests

```sh
npm ci
npm run typecheck
npm run build   # rebuilds dist/ with ncc
npm test
```

`npm test` runs the bundled `dist/index.js` in a fresh Node process, the way the runner does, with
`INPUT_*` / `GITHUB_*` variables and `GITHUB_API_URL` pointed at a small fake GitHub API
(`test/fake-github.mjs`). It checks that the labels arrive as one
`POST /repos/{owner}/{repo}/issues/{number}/labels` with the token, that the number falls back to the
triggering issue or pull request, that empty input makes no call, that API errors fail the step, that
no `::set-output` / `::save-state` or Node deprecation warnings are printed, and that `action.yml`
uses `node24` with the upstream inputs unchanged. `test/act-workflow.yml` runs the action through
[act](https://github.com/nektos/act).

## License

Copyright 2020 The Actions Ecosystem Authors. Modifications copyright 2026 Joshua Almeida.

Released under the [Apache License 2.0](./LICENSE). See [NOTICE](./NOTICE) for the list of changes.
