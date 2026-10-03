# The image AIDEV runs this project's suites in (`environment.image` in
# .aidev/project.yaml). It is CI's image: the shared emsdk image that
# common-ci-configuration's npm_projects template pins (EMSCRIPTEN_IMAGE_TAG
# 5.0.2-2 at the ref .gitlab-ci.yml includes), with Node 22.21.1, pnpm 10.0.0
# through corepack and Playwright browsers in /home/emscripten/pw-browsers.
# Suites run with `--network none` and the caller's uid, so this layer adds what
# an install and a test run would otherwise download: pnpm (package.json's
# `packageManager`), a pnpm store filled from pnpm-lock.yaml, the Chromium build
# of the Playwright version the lockfile pins (CI's `pretest` runs `playwright
# install chromium`; the base image's browsers are for another Playwright), and
# http-server (playwright.config.ts starts it with `npx http-server`; it isn't in
# the lock).
# Build and pin it with .aidev/runtime/build.sh; see .aidev/README.md.
FROM registry.gitlab.syncad.com/hive/common-ci-configuration/emsdk@sha256:e3d1688dfd001c57e78b9c4e8a83c7bd7426ecae9b69bebd0fca756e2ab900f0

ARG HTTP_SERVER_VERSION=14.1.1

USER root
ENV PATH=/home/emscripten/.nvm/versions/node/v22.21.1/bin:$PATH \
    COREPACK_HOME=/opt/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    COREPACK_ENABLE_NETWORK=0 \
    npm_config_store_dir=/opt/pnpm-store \
    npm_config_update_notifier=false \
    HUSKY=0 \
    DO_NOT_TRACK=1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc /tmp/pnpm-fetch/
COPY packages/signers-hb-auth/package.json /tmp/pnpm-fetch/packages/signers-hb-auth/
RUN cd /tmp/pnpm-fetch \
    && COREPACK_ENABLE_NETWORK=1 corepack install -g "$(node -p "require('./package.json').packageManager")" \
    && pnpm fetch \
    && playwright="$(awk '/^  playwright-toolset:/{f=1} f&&/^    playwright:/{getline;getline;print $2;exit}' pnpm-lock.yaml)" \
    && npx -y "playwright@${playwright:?no playwright version in pnpm-lock.yaml}" install chromium \
    && npm install -g --no-audit --no-fund "http-server@${HTTP_SERVER_VERSION}" \
    && cd / && rm -rf /tmp/pnpm-fetch \
    && chmod -R a+rwX /opt/pnpm-store /opt/corepack \
    && chmod -R a+rX /home/emscripten/.nvm /home/emscripten/pw-browsers

USER emscripten
ENV HOME=/tmp
# The emsdk entrypoint sources emsdk_env.sh, which puts emsdk's own Node 22.16
# first on PATH; the suites don't need emscripten, and must run CI's 22.21.1.
ENTRYPOINT []
CMD ["bash"]
