# GitHub Operations Guide

This document defines how to configure GitHub so the project can be managed end-to-end through the repository and the GitHub CLI.

## 1. Account Setup

Recommended baseline for the repository owner:

- enable 2FA on GitHub
- install GitHub CLI
- log in with `gh auth login`
- configure SSH signing or at least SSH push access

Once `gh` is authenticated on this machine, an agent can help with:

- issue triage
- pull request review flow
- labels and milestones
- release creation
- repository settings checks

## 2. Repository Setup

After creating the GitHub repository:

1. add the remote
2. push `main`
3. confirm repository URLs, `LICENSE`, and contact email values

Recommended repository settings:

- default branch: `main`
- allow squash merge: on
- allow rebase merge: on
- allow merge commits: off
- auto-delete head branches: on
- discussions: optional but recommended

## 3. Branch Protection / Ruleset

Protect `main` with these rules:

- require a pull request before merging
- require at least 1 approval
- require conversation resolution
- require status checks:
  - `Test (Node 22)`
  - `Test (Node 24)`
- block force pushes
- block branch deletion

Enable code owner review if you want `@cloud-11` review enforcement on protected branches.

## 4. Secrets and Environments

Repository secrets:

- `NPM_TOKEN` for npm publishing

Recommended environment:

- `release`
  - optional required reviewer before production releases

## 5. Daily Maintainer Flow

### Issue triage

- confirm reproducibility for bugs
- request missing reproduction details
- label by type and area
- mark suitable starter tasks with `good first issue`

### Pull requests

- ensure the PR template is completed
- check CI first
- review for scope, docs, and release impact
- squash merge small focused PRs

### Releases

- bump `package.json`
- update `CHANGELOG.md`
- create tag `vX.Y.Z`
- push tag
- let `Release` workflow create the GitHub release and optionally publish to npm

## 6. Labels to Create

Recommended label set:

- `bug`
- `enhancement`
- `documentation`
- `github`
- `plugin-core`
- `release`
- `tests`
- `dependencies`
- `needs-triage`
- `good first issue`
- `help wanted`
- `breaking`

## 7. What the Agent Can Take Over

With authenticated `gh` access, the agent can reliably help with:

- creating and editing issues
- commenting on and triaging issues
- opening and reviewing PRs
- drafting release notes
- creating releases
- syncing labels and milestones

What still needs your explicit decision:

- npm package name and publication scope
- organization/user ownership of the repository
