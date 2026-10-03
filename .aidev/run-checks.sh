#!/usr/bin/env bash
# The checks AIDEV's verification slots run (.aidev/project.yaml), as one junit
# report per suite: each named step is a test case, its log the failure body.
#
#   .aidev/run-checks.sh <suite> <step>...     steps: lint typecheck build offline docs
#
#   lint       ESLint over src/ with --max-warnings 0 (CI's lint job)
#   typecheck  tsc --noEmit for the library (tsconfig.json)
#   build      the published artifact: `rollup -c`, then the files package.json
#              `exports` / `types` name must exist in dist/ (step dist-exports),
#              then tsc --noEmit for packages/signers-hb-auth, which imports the
#              built dist/hb-auth.d.ts (step signers-typecheck)
#   offline    the Playwright suite's offline half ("HB Auth Offline Client"),
#              in headless Chromium against the built dist/, every test its own
#              junit case in $out/playwright-junit.xml. Runs `build` first when
#              dist/ is missing. The online half needs the live Hive API and the
#              CI_TEST_USER* secrets, so it isn't run here (see .aidev/README.md).
#   docs       the API docs CI's generate_docs job publishes to the wiki
#              (scripts/generate_api_docs.sh: typedoc + markdown plugins), into
#              $out/docs
set -uo pipefail
cd "$(dirname "$0")/.."

suite="${1:?usage: $0 <suite> <step>...}"; shift
out="test-results/aidev-$suite"
rm -rf "$out"; mkdir -p "$out"
cases="$out/cases.tsv"; : > "$cases"

source .aidev/junit-helpers.sh
fail_setup() {
    printf 'case\t%s\tfail\t0\t%s\n' "$1" "$2" >> "$cases"
    junit_write_cases "$out/junit.xml" "$suite" "$cases"
    exit 1
}

# pnpm-workspace.yaml is a symlink into the common-ci-configuration submodule
# (it carries the `catalog:` versions the lockfile was resolved with).
[ -f pnpm-workspace.yaml ] || fail_setup workspace \
    "pnpm-workspace.yaml does not resolve: the common-ci-configuration submodule is not checked out"
# shellcheck source=pnpm-deps.sh
source .aidev/pnpm-deps.sh || fail_setup install "pnpm install --offline failed"

status=0
step() {
    local name="$1"; shift
    local log="$out/$name.log" t0=$SECONDS rc=0
    echo "== $name" >&2
    "$@" > "$log" 2>&1 < /dev/null || rc=$?
    if [ "$rc" -eq 0 ]; then
        printf 'case\t%s\tpass\t%s\t\n' "$name" "$((SECONDS - t0))" >> "$cases"
    else
        status=1; tail -40 "$log" >&2
        printf 'case\t%s\tfail\t%s\texit %s\t%s\n' "$name" "$((SECONDS - t0))" "$rc" "$log" >> "$cases"
    fi
    return "$rc"
}

check_dist() {
    node -e '
const fs = require("fs");
const pkg = require("./package.json");
const flat = (e) => typeof e === "string" ? [e] : Object.values(e).flatMap(flat);
const want = [pkg.types, ...flat(pkg.exports || {})].filter((f) => f && f !== "./package.json");
const missing = want.filter((f) => !fs.existsSync(f));
if (missing.length) { console.error("missing from the build:", missing.join(", ")); process.exit(1); }
console.log("dist provides", want.join(", "));'
}

build() {
    step build bash -c 'rm -rf dist && pnpm exec rollup -c' && step dist-exports check_dist \
        && step signers-typecheck pnpm exec tsc --noEmit -p packages/signers-hb-auth/tsconfig.json
}

# The project's `pnpm test` minus `pretest` (the browser is in the image) and
# minus the online describe block. playwright.config.ts writes results.xml;
# --output keeps Playwright from emptying test-results/, where $out lives.
offline_tests() {
    local rc=0
    rm -f results.xml results.json
    pnpm exec playwright test --workers 1 --project=hbauth_testsuite \
        --grep "HB Auth Offline Client" --output "$out/playwright-output" || rc=$?
    [ -s results.xml ] && cp results.xml "$out/playwright-junit.xml"
    [ -s results.json ] && cp results.json "$out/playwright-results.json"
    if [ "$rc" -ne 0 ]; then
        junit_add_unreported_failure "$out/playwright-junit.xml" offline "playwright run" "$out/offline.log" "$rc"
    fi
    return "$rc"
}

built=0
for s in "$@"; do
    case "$s" in
        lint) step lint pnpm exec eslint src --ext .ts --max-warnings=0 ;;
        typecheck) step typecheck pnpm exec tsc --noEmit -p tsconfig.json ;;
        build) build; built=1 ;;
        offline)
            if [ "$built" -eq 0 ] && [ ! -f dist/hb-auth.js ]; then build; built=1; fi
            (unset CI; step offline offline_tests) || status=1
            ;;
        docs) step docs scripts/generate_api_docs.sh https://gitlab.syncad.com/hive/hb-auth \
                "${AIDEV_COMMIT_SHA:-develop}" "" "$out/docs" ;;
        *) echo "unknown step: $s" >&2; exit 2 ;;
    esac
done
# `step` in the subshell above appended to $cases directly; its status is
# carried by the subshell's exit code.
junit_write_cases "$out/junit.xml" "$suite" "$cases"
exit "$status"
