# Sourced by the .aidev suite scripts: make node_modules match pnpm-lock.yaml,
# offline, from the image's store. A marker records the lockfile and Node it was
# installed for; it is written only after an install that succeeded, and an
# install whose tools don't resolve is redone.
lock_id="$(sha256sum pnpm-lock.yaml | cut -d' ' -f1) $(node --version)"
marker=node_modules/.aidev-pnpm-lock
tools_ok() { [ -x node_modules/.bin/rollup ] && [ -x node_modules/.bin/tsc ] && [ -x node_modules/.bin/playwright ]; }
if [ "$(cat "$marker" 2>/dev/null)" != "$lock_id" ] || ! tools_ok; then
    echo "node_modules is not current for pnpm-lock.yaml: pnpm install --offline" >&2
    HUSKY=0 pnpm install --offline --frozen-lockfile < /dev/null || return 1
    tools_ok || { echo "pnpm install left no rollup/tsc/playwright" >&2; return 1; }
    printf '%s\n' "$lock_id" > "$marker.tmp" && mv "$marker.tmp" "$marker"
fi
