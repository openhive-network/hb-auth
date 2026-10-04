# hb-auth under AIDEV

AIDEV verifies changes to this library through the slots in `project.yaml`, integrates
them into `aidev/integration`, and people merge that into `develop` through merge
requests (as in hive/denser). GitLab CI doesn't run for AIDEV branches; see
`.gitlab-ci.yml` `workflow:`.

## Suites

`.aidev/run-checks.sh <suite> <step>...` runs the named steps and writes
`test-results/aidev-<suite>/junit.xml`, one test case per step, with the step's log
tail as the failure body. The `offline` step also leaves Playwright's own junit,
one case per test, in `playwright-junit.xml` beside it.

| Step | What |
|---|---|
| `lint` | ESLint over `src/`, `--max-warnings 0` (CI's `lint` job) |
| `typecheck` | `tsc --noEmit` (tsconfig.json) |
| `build` | the published artifact: `rollup -c` |
| `dist-exports` | (after `build`) the files package.json `exports`/`types` name exist in `dist/` |
| `signers-typecheck` | (after `build`) `tsc --noEmit` for `packages/signers-hb-auth`, which imports the built `dist/hb-auth.d.ts` |
| `offline` | the Playwright suite's "HB Auth Offline Client" tests in headless Chromium against `dist/` (29 tests, 2 skipped in the source); builds first when `dist/` is missing |
| `docs` | `scripts/generate_api_docs.sh` (typedoc, CI's `generate_docs` job) into the suite's directory |

| Slot | Steps |
|---|---|
| quick | lint, typecheck, build, offline |
| full, canary | lint, typecheck, build, offline, docs |
| static | lint, typecheck |
| baseline, coverage, system | build, offline |

Not run by any slot:

- **The online tests** (`src/__tests__/online.ts`, "HB Auth Online Client"). They
  talk to the live Hive API and need a funded test account's keys
  (`CI_TEST_USER*`, see `.env.example`); suites run with `--network none` and no
  secrets.
- **Coverage.** There's no coverage tooling, so `coverage` runs the same tests as
  `baseline`.
- **The npm package and wiki publishing** that CI does (`deploy_*`, `push_to_wiki`).
  AIDEV doesn't publish this package.

## The test runtime image (`runtime/`)

The suites run in a container with `--network none` and your uid. The image is CI's
image, the shared `emsdk` image at the tag `common-ci-configuration`'s
`npm_projects` template pins (5.0.2-4: Node 24.21.0, pnpm 10.0.0), plus:

- pnpm from package.json `packageManager`, installed through corepack;
- a pnpm store filled with `pnpm fetch`;
- the Chromium build that the lockfile's Playwright version needs.

`pnpm-deps.sh` installs `node_modules` offline from the store. The emsdk entrypoint
is cleared, so emsdk's own Node doesn't shadow 24.21.0.

When `pnpm-lock.yaml`, `pnpm-workspace.yaml` (a symlink into the
`common-ci-configuration` submodule), `.npmrc`, `packageManager`,
`packages/signers-hb-auth/package.json` or `runtime/Dockerfile` change, rebuild and
re-pin **in the same commit**:

```bash
.aidev/runtime/build.sh --push   # registry digest if aidev-<input hash> exists, else build + push
# put the printed repo@sha256:<digest> into project.yaml environment.image
```

Run a suite by hand the same way AIDEV does:

```bash
git submodule update --init   # pnpm-workspace.yaml lives in common-ci-configuration
docker run --rm --network none --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD":/work -w /work <environment.image> .aidev/run-checks.sh quick lint typecheck build offline
```
