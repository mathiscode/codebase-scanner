#!/bin/bash

echo "Codebase Scanner"
echo "- https://github.com/mathiscode/codebase-scanner"

echo "Enter the repo url you want to scan: "
read repo_url
git clone --quiet $repo_url /opt/repo
npm_config_yes=true npx @mathiscode/codebase-scanner /opt/repo
