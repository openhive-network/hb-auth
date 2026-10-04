# The image AIDEV runs this project's suites in (`environment.image` in
# .aidev/project.yaml). It is CI's image: the shared emsdk image that
# common-ci-configuration's npm_projects template pins (EMSCRIPTEN_IMAGE_TAG
# 5.0.2-4 at the ref .gitlab-ci.yml includes), with Node 24.21.0, pnpm 10.0.0
# through corepack and Playwright browsers in /home/emscripten/pw-browsers.
# Suites run with `--network none` and the caller's uid, so this layer adds what
# an install and a test run would otherwise download: pnpm (package.json's
# `packageManager`), a pnpm store filled from pnpm-lock.yaml, the Chromium build
# of the Playwright version the lockfile pins (CI's `pretest` runs `playwright
# install chromium`; the base image's browsers can be for another Playwright).
# Build and pin it with .aidev/runtime/build.sh; see .aidev/README.md.
FROM registry.gitlab.syncad.com/hive/common-ci-configuration/emsdk@sha256:966dd9e9da494d184fcc7f622bb24d93c41b8d58c814156aa79cd1d70f31d9ab

USER root
ENV PATH=/home/emscripten/.nvm/versions/node/v24.21.0/bin:$PATH \
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
    && cd / && rm -rf /tmp/pnpm-fetch \
    && chmod -R a+rwX /opt/pnpm-store /opt/corepack \
    && chmod -R a+rX /home/emscripten/.nvm /home/emscripten/pw-browsers

USER emscripten
ENV HOME=/tmp
# The emsdk entrypoint sources emsdk_env.sh, which puts emsdk's own Node 22.16
# first on PATH; the suites don't need emscripten, and must run CI's 24.21.0.
# The image's default `node` (pnpm env's, ~/.local/share/pnpm) is 24.21.0 too,
# but corepack is only in nvm's directory, hence PATH above.
ENTRYPOINT []
CMD ["bash"]
