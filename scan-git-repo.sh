#!/bin/bash

echo "Codebase Scanner"
echo "- https://github.com/mathiscode/codebase-scanner"

echo "Enter the repo url you want to scan: "
read repo_url

TMPDIR=$(mktemp -d)
git clone --quiet $repo_url $TMPDIR
npm config set update-notifier false
NODE_NO_WARNINGS=true npm_config_yes=true npx @mathiscode/codebase-scanner@latest local $TMPDIR
rm -rf $TMPDIR
