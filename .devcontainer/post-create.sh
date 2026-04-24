#!/bin/bash
set -e

# install apm (the Agent Package Manager: https://github.com/microsoft/apm)
curl -sSL https://aka.ms/apm-unix | sh

# Install OpenCode CLI
# curl -fsSL https://opencode.ai/install | bash

# Install Snyk CLI
curl --compressed https://static.snyk.io/cli/latest/snyk-linux-arm64 -o snyk
chmod +x ./snyk
sudo mv -f ./snyk /usr/local/bin/snyk
# Then configure Snyk to use an API Key or Token
# 1. fetch it from the Settings page in the Snyk UI: https://app.snyk.io/org/<org-id>/manage/service-accounts
# 2. set it as the snyk api config: snyk config set api=<api-key-or-token>

# Install 1Password CLI (op) - arm64 Linux binary
# OP_VERSION="2.32.1"
# curl -fsSL "https://cache.agilebits.com/dist/1P/op2/pkg/v${OP_VERSION}/op_linux_arm64_v${OP_VERSION}.zip" -o /tmp/op.zip
# python3 -c "import zipfile; zipfile.ZipFile('/tmp/op.zip').extract('op', '/tmp')"
# sudo mv /tmp/op /usr/local/bin/op && chmod +x /usr/local/bin/op && rm /tmp/op.zip