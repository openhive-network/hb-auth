#!/bin/bash

set -e

echo "Checking if API documentation should update..."

SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
PROJECT_DIR="${SCRIPTPATH}/../"

# When using TypeScript 4.4.4, we are restricted to a specific typedoc and typedoc-plugin-markdown versions
# https://typedoc.org/guides/installation/#requirements
pushd "${PROJECT_DIR}"
mkdir -vp build
npm exec -- typedoc --plugin typedoc-plugin-markdown --theme markdown --excludeInternal --hideBreadcrumbs --hideInPageTOC --tsconfig tsconfig.docs.json --out build/docs dist/hb-auth.d.ts
mv build/docs/modules.md build/docs/_modules.md
rm build/docs/README.md
npm exec -- concat-md --decrease-title-levels build/docs > api.md
popd

UNSTAGED_FILES=($(git diff --name-only))

if [[ " ${UNSTAGED_FILES[*]} " =~ " api.md " ]];
then
  echo "api.md file changes detected. Stage documentation changes before commit"
  exit 1
fi

echo "No unstaged changes in the documentation"
