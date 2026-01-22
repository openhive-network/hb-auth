# HB-Auth - Claude Code Reference

## Project Overview

HB-Auth is a browser-based authentication library for Hive blockchain applications. It securely manages user signing operations using WebWorkers and encrypted IndexedDB storage, leveraging the Beekeeper library for key management. Private keys never leave the WebWorker context.

**Key features:**
- WebWorker-based key isolation (keys never exposed to main thread)
- Encrypted IndexedDB storage with session timeout
- Online mode: Verifies account ownership via blockchain
- Offline mode: Local-only operation without blockchain verification
- SharedWorker support for tab-sharing

## Tech Stack

- **Language**: TypeScript (strict mode, ES2022 target)
- **Runtime**: Browser (WebWorker, IndexedDB)
- **Package Manager**: pnpm 10.0.0+ (workspace monorepo)
- **Build**: Rollup 4.x with esbuild
- **Testing**: Playwright (browser E2E tests)
- **Linting**: ESLint + Prettier
- **Key Dependencies**:
  - `@hiveio/wax` - Transaction creation/broadcasting
  - `@hiveio/beekeeper` - Wallet/key management (WASM)
  - `comlink` - WebWorker RPC
  - `idb` - IndexedDB wrapper

## Directory Structure

```
hb-auth/
├── src/
│   ├── index.ts           # Main exports
│   ├── client.ts          # OnlineClient, OfflineClient classes
│   ├── worker.ts          # AuthWorker (runs in WebWorker)
│   ├── errors.ts          # Error classes with XSS prevention
│   ├── environment.ts     # Browser capability detection
│   └── __tests__/         # Playwright test files
│       ├── offline.ts     # OfflineClient tests
│       ├── online.ts      # OnlineClient tests
│       └── assets/        # Test HTML pages with import maps
├── packages/
│   └── signers-hb-auth/   # Wax signer provider package
├── example/               # Demo application (Parcel)
├── scripts/               # Build/doc generation scripts
├── common-ci-configuration/  # Git submodule (shared CI templates)
└── dist/                  # Build output (generated)
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Build (outputs to dist/)
pnpm build

# Run linter
pnpm lint

# Run tests (requires built dist/)
pnpm test

# Clean build artifacts
pnpm clean
```

**Test Environment Variables** (create `.env` from `.env.example`):
- `CI_TEST_USER` - Test account username
- `CI_TEST_USER_WIF_POSTING` - Private posting key
- `CI_TEST_USER_WIF_ACTIVE` - Private active key
- `CI_TEST_AUTHORITY_USER` - Authority test account
- `CI_TEST_AUTHORITY_USER_WIF_POSTING` - Authority key

## Key Files

| File | Purpose |
|------|---------|
| `src/client.ts` | Main API - OnlineClient, OfflineClient classes |
| `src/worker.ts` | AuthWorker implementation (WebWorker context) |
| `src/errors.ts` | GenericError, AuthorizationError, InternalError |
| `rollup.config.js` | Build configuration (main + worker bundles) |
| `playwright.config.ts` | E2E test configuration |
| `tsconfig.json` | TypeScript configuration |
| `.eslintrc.cjs` | ESLint rules (standard-with-typescript) |
| `packages/signers-hb-auth/` | HBAuthProvider for wax signing |

## Coding Conventions

**TypeScript patterns:**
- Private fields use `#` prefix (`#worker`, `#auth`)
- Async/await throughout
- Class-based architecture
- Error handling via custom error classes with `htmlSafe()` for XSS prevention

**ESLint configuration:**
- Extends: standard-with-typescript + prettier
- Max warnings: 0 (strict)
- Browser + Node environments

**Security patterns:**
- Keys isolated in WebWorker
- Session timeout (default 900s)
- HTML-safe error escaping
- Signature verification against blockchain authorities

## CI/CD Notes

**GitLab CI Pipeline** (`.gitlab-ci.yml`):

| Stage | Jobs |
|-------|------|
| pre-stage | `lint` |
| build | `build`, `generate_docs` |
| test | `test` (Playwright) |
| post-test | `push_to_wiki` |
| deploy | `deploy_dev_package`, `deploy_production_public_npm` |

**Key details:**
- Uses shared templates from `common-ci-configuration/` submodule
- Package placeholders (`$npm_package_version`, `$npm_package_dist_tag`) replaced during build
- Docs generated with TypeDoc → GitLab Wiki
- Dev packages: Internal @hiveio registry
- Production: npmjs.org (on git tags)

**Protected branches:** `develop`, `master` - create feature branches for changes.

## API Overview

```typescript
import { createHiveChain } from '@hiveio/wax';
// Online client (verifies keys against blockchain)
const client = new OnlineClient({ nodeUrl: 'https://api.hive.blog' });
await client.initialize(await createHiveChain());
await client.register('username', 'password', 'wif_key', 'posting');
await client.authenticate('username', 'password', 'posting');
const signature = await client.sign('username', 'digest', 'posting');
await client.logout('username');

// Offline client (local-only, no blockchain verification)
const offlineClient = new OfflineClient();
await offlineClient.initialize();
// Same API as OnlineClient

// Wax signer integration
import { HBAuthProvider } from '@aspect-wallet/signers-hb-auth';
const provider = await HBAuthProvider.for(client, 'username', 'posting');
```
