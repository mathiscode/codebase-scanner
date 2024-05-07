#!/bin/bash

echo "Enter the repo url: "
read repo_url
git clone --quiet $repo_url /opt/repo
npm_config_yes=true npx @mathiscode/codebase-scanner /opt/repo
