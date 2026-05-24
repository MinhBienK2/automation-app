# Release Governance

This repository uses file-based automation for CI, packaging, artifact integrity,
SBOM generation, CodeQL, and Dependabot. Some controls are GitHub repository or
organization settings and must be configured by an owner.

## Required Repository Settings

Configure branch protection or an equivalent repository ruleset for `main`:

- Require pull requests before merge.
- Require at least one approving review.
- Require required status checks before merge, including `Desktop CI / Quality gates`
  and `CodeQL / Analyze JavaScript and TypeScript`.
- Require branches to be up to date before merge or use a merge queue.
- Restrict direct pushes to `main`.

Configure the `internal-release` environment:

- Add required reviewers for release approval.
- Restrict deployments to protected branches and tags matching `v*`.
- Disable admin bypass when the repository policy allows it.
- Store release signing secrets only in the `internal-release` environment.

Enable repository security controls:

- Enable secret scanning.
- Enable push protection.
- Enable Dependabot alerts.
- Enable CodeQL code scanning.

## Optional Release Signing Secrets

The release workflow can produce unsigned internal artifacts when signing
secrets are not configured. Add the secrets below when the release should be
signed and notarized for broader distribution.

macOS signing and notarization:

- `MAC_CSC_LINK`
- `MAC_CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

Windows signing:

- `WIN_CSC_LINK`
- `WIN_CSC_KEY_PASSWORD`

`CSC_LINK` should be a secure certificate reference or base64-encoded certificate
supported by electron-builder. Keep signing credentials scoped to
`internal-release`; do not store them as plain repository variables.

## Release Flow

1. Merge code through protected PRs after required checks pass.
2. Run `npm run deploy` from a clean worktree to run local tests/build, bump the
   patch version, commit the version change, create the matching `v*` tag, push
   the branch, and push the tag. Use `npm run deploy -- --minor` or
   `npm run deploy -- --major` when the release needs a larger version bump, and
   `npm run deploy -- --dry-run` to preview the command plan without changing
   git state.
3. The Desktop Release workflow runs quality gates, waits for the
   `internal-release` environment approval, packages macOS, Windows, and
   Ubuntu/Linux artifacts, signs supported platforms with environment secrets,
   generates `sbom.cyclonedx.json`, `SHA256SUMS`, and `release-manifest.json`
   with actual `generated_at` provenance plus deterministic `reproducible_epoch`,
   creates artifact attestations, and uploads assets to the GitHub release.
4. Operators verify checksums and release provenance before installation.

## CloakBrowser upgrade gate

`cloakbrowser` is exact-pinned because wrapper patches can change browser
fingerprint, launch, diagnostics, or evidence behavior. Dependabot must keep it
out of broad npm minor/patch groups so every upgrade is reviewed as a
browser/fingerprint change.

Before changing the pinned version:

- Change `package.json` and `package-lock.json` to the exact new version.
- Run the owned fingerprint preflight matrix for representative identities.
- Run the owned staging smoke lane against allowlisted targets and named test
  accounts.
- Complete a run evidence comparison before and after the upgrade, including
  browser identity, preflight verdicts, action traces, and failure artifacts.
- Document the rollback version and rollback command plan in the upgrade PR.
