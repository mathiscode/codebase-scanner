# Codebase Scanner

Scan a folder, repository, npm/pypi package, or dependencies for malicious signatures.

> Made with ❤️ by [Jay Mathis](https://github.com/mathiscode)

---

[![NPM Malware Results](https://img.shields.io/badge/NPM%20Registry-Malware%20Results-success)](https://mathiscode.github.io/codebase-scanner/pages/npm.html)

[![Sponsors](https://img.shields.io/github/sponsors/mathiscode?color=red&label=sponsors)](https://github.com/sponsors/mathiscode)
[![Version](https://img.shields.io/github/package-json/v/mathiscode/codebase-scanner?color=success)](https://www.npmjs.com/package/@mathiscode/codebase-scanner)
[![npm](https://img.shields.io/npm/dw/@mathiscode/codebase-scanner?color=success)](https://www.npmjs.com/package/@mathiscode/codebase-scanner)
[![Docker](https://img.shields.io/docker/pulls/mathiscode/codebase-scanner?color=success)](https://hub.docker.com/r/mathiscode/codebase-scanner)
[![Created](https://img.shields.io/github/created-at/mathiscode/codebase-scanner?style=flat&label=created&color=success)](https://github.com/mathiscode/codebase-scanner/pulse)
[![Last Commit](https://img.shields.io/github/last-commit/mathiscode/codebase-scanner.svg)](https://github.com/mathiscode/codebase-scanner/commit/main)
[![GitHub license](https://img.shields.io/badge/license-MIT-success)](https://github.com/mathiscode/codebase-scanner/blob/main/LICENSE.md)

---

## Usage

```text
Usage: codebase-scanner [options] [command]

Scan a folder, repository, npm/pypi package, or dependencies for malicious signatures.

Options:
  -V, --version             output the version number
  -f, --fix                 Fix flagged files by injecting a plain text header (local command only)
  -a, --all                 Scan all files, ignoring default extension filters (applies to all scan commands)
  -l, --limit <size>        Set the file size limit in bytes (default: 1MB, applies to all scan commands)
  -j, --json                Output results in JSON format (applies to all scan commands)
  -h, --help                display help for command

Commands:
  local [options] [folder]  Scan a local folder (defaults to current directory)
  npm [options] <package>   Download and scan an npm package
  pypi [options] <package>  Download and scan a PyPI package
  deps [options] <path>     Scan dependencies specified in a directory (package.json/requirements.txt)
  help [command]            display help for command
```

### Scan a repository in a Docker container

```bash
docker run -it --rm mathiscode/codebase-scanner:latest
# Enter the repo url: https://github.com/owner/repo
# ☠️ Found malicious signature Obfuscated Javascript (Buffered "child_process") in file /path/to/codebase/malware.js
```

### Scan a local codebase

```bash
# Just scan
npx @mathiscode/codebase-scanner@latest local /path/to/codebase
# ☠️ Found malicious signature Obfuscated Javascript (Buffered "child_process") in file /path/to/codebase/malware.js
```

```bash
# Scan and fix
npx @mathiscode/codebase-scanner@latest local --fix /path/to/codebase
# ☠️ Found malicious signature Obfuscated Javascript (Buffered "child_process") in file /path/to/codebase/malware.js
# 🚨 Detected and modified malicious file /path/to/codebase/malware.js - review immediately
```

### Scan all dependencies of a codebase

```bash
# autodetects package.json or requirements.txt
npx @mathiscode/codebase-scanner@latest deps /path/to/codebase
# ☠️ Found malicious signature Obfuscated Javascript (Buffered "child_process") in file /path/to/codebase/malware.js
```

### Scan an [npm](https://www.npmjs.com) package

```bash
npx @mathiscode/codebase-scanner@latest npm package-name
# ☠️ Found malicious signature Obfuscated Javascript (Buffered "child_process") in file /path/to/codebase/malware.js
```

### Scan a [PyPI](https://pypi.org) package

```bash
npx @mathiscode/codebase-scanner@latest pypi package-name
# ☠️ Found malicious signature Obfuscated Python (PyArmor Hook) in file /path/to/codebase/malware.py
```

### Install as a CLI

```bash
npm install -g @mathiscode/codebase-scanner@latest
codebase-scanner --help
```

---

## Exit Codes

- `0`: No malicious code found
- `1`: Malicious code found
- `2`: Error

## JSON Output

The tool can output a JSON array of detections. This can be used in more complex flows.

```bash
npx @mathiscode/codebase-scanner@latest local --json /path/to/codebase
```

```json
[
  {
    "file": "/path/to/codebase/malware.js",
    "triggered": true,
    "level": "malicious",
    "index": 3,
    "name": "Obfuscated Javascript (Buffered \"child_process\")"
  }
]
```

## Malicious File Header

When a file is fixed (using the `--fix` option with the `local` command), the following header is prepended to the file:

```text
========= MALICIOUS ========= [hidden unicode characters to help break loading]
This file has been flagged as malicious by https://github.com/mathiscode/codebase-scanner
Please review the file and remove these lines if appropriate.
========= MALICIOUS ========= [hidden unicode characters to help break loading]
```

---

## Reasoning

This started as a quick and dirty tool to help defend against common developer-focused malware campaigns since many of these go unnoticed by common antivirus software.

A common scam is to have a developer "take a look" at a codebase or perform a "test task", and then it starts exfiltrating data.

When a signature is found, the filename is printed to the console and optionally fixed (if `local --fix` is passed). When fixing, a header is prepended to the file to prevent the malware from running or being imported. This may not be foolproof, so always exercise caution and do everything possible to avoid letting the codebase run any scripts.

Inspired by [this experience](https://www.reddit.com/r/Upwork/comments/14nat71/scam_warning_blockchain_developer_job_postings) (obfuscated Javascript steals your browser profiles and other files via a "test task" on freelancing sites, hidden within a seemingly innocuous codebase).

**PRs welcome!**

Have you found a new signature? Please submit a PR with the signature added to [`signatures/`](signatures/) and a sample file in the [`samples/`](samples/) directory. Currently, signature file `0.js` is Javascript signatures and `1.js` is Python signatures.

To see samples of some of these malicious codebases, check out [this repository](https://github.com/rubenmarcus/malicious-repositories).
