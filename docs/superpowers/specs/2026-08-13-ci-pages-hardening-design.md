# CI and GitHub Pages Hardening Design

## Goal
Harden the repository's CI and Pages deployment against supply-chain and direct-publish risk while preserving the calculator application's browser-only behavior.

## Scope
This PR will make three related workflow hardening changes:

1. Pin GitHub Actions to immutable full commit SHAs while preserving current major versions.
2. Add a 10-minute timeout to CI jobs that execute repository-controlled code.
3. Replace legacy branch-based Pages publishing with an explicit validate -> build -> upload artifact -> deploy workflow.

Resolved upstream action pins as of 2026-08-13:

- `actions/checkout@v4` -> `11d5960a326750d5838078e36cf38b85af677262`
- `actions/setup-node@v4` -> `49933ea5288caeca8642d1e84afbd3f7d6820020`
- `actions/configure-pages@v5` -> `983d7736d9b0ae728b81ab479565c72886d7745b`
- `actions/upload-pages-artifact@v4` -> `7b1f4a764d45c48632c6b24a0339c27f5614fb0b`
- `actions/deploy-pages@v4` -> `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e`

Human-readable comments may retain the corresponding major tag beside each SHA.

## Build Boundary
Add a minimal repository-native build script that recreates `_site/` and copies only files required by the public application:

- `index.html`
- `styles.css`
- `app.js`
- `src/calculators.mjs`

The build must not publish tests, GitHub workflow files, package metadata, documentation, or other repository contents. `_site/` will be ignored by Git.

The existing package scripts remain the source of truth for syntax/tests; a small `build` script may be added to invoke the public-artifact builder.

## Workflow Design
The existing validation workflow continues to run for pushes to `main` and pull requests with `contents: read` and a 10-minute timeout.

A Pages workflow will run on pushes to `main` and optional manual dispatch. It will:

1. check out the exact repository revision;
2. set up Node 22;
3. run the repository checks/tests;
4. build the allowlisted `_site/` artifact;
5. configure Pages;
6. upload only `_site/`;
7. deploy using the `github-pages` environment.

Deployment permissions are limited to `contents: read`, `pages: write`, and `id-token: write`. No pull-request workflow receives Pages write or OIDC permissions.

## Invariants
- Calculator formulas, input validation, DOM rendering, theme persistence, styles, and visible content remain unchanged.
- No third-party runtime dependencies, external scripts, analytics, APIs, cookies, or new storage are introduced.
- The public site remains HTTPS GitHub Pages at the existing project URL.
- CI remains safe for pull requests because its token stays read-only and deployment is not triggered by pull requests.

## Verification
Before opening the PR:

1. `npm test` must pass.
2. `npm run build` (or the equivalent direct build command) must succeed.
3. `_site/` must contain exactly the four approved runtime files/directories described above, with no repository metadata or test files.
4. Built copies of `index.html`, `styles.css`, `app.js`, and `src/calculators.mjs` must be byte-identical to their source counterparts.
5. Review the workflow diff to confirm all external Actions are pinned to the resolved SHAs and the CI token remains read-only.
6. After merge, GitHub Pages must be switched from legacy branch publishing to GitHub Actions if GitHub does not automatically select the workflow build source. That repository-setting transition must be verified rather than assumed.

## Out of Scope
- Branch protection/rulesets, because the connected GitHub tool does not expose a ruleset write operation here.
- Calculator feature changes or refactors.
- Dependency additions.
