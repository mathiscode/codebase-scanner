<!-- markdownlint-disable MD033 -->

# Codebase Scanner

[npm](https://www.npmjs.com/package/@mathiscode/codebase-scanner)

[Docker Hub](https://hub.docker.com/r/mathiscode/codebase-scanner)

A quick and dirty tool to help defend against common developer-focused malware campaigns since many of these go unnoticed by common antivirus software.

A common scam is to have a developer "take a look" at a codebase or perform a "test task", and then it starts exfiltrating data.

When a signature is found, the filename is printed to the console and optionally fixed (if `--fix` is passed). When fixing, a header is prepended to the file to prevent the malware from running or being imported. This may not be foolproof, so always exercise caution and do everything possible to avoid letting the codebase run any scripts.

Inspired by [this experience](https://www.reddit.com/r/Upwork/comments/14nat71/scam_warning_blockchain_developer_job_postings) (obfuscated Javascript steals your browser profiles and other files via a "test task" on freelancing sites, hidden within a seemingly innocuous codebase).

**PRs welcome!**

Have you found a new signature? Please submit a PR with the signature added to [`signatures.js`](signatures.js) and a sample file in the [`samples/`](samples/) directory.

To see samples of some of these malicious codebases, check out [this repository](https://github.com/rubenmarcus/malicious-repositories).

## Usage

Scan a repository in a Docker container:

```bash
docker run -it --rm mathiscode/codebase-scanner:latest
# Enter the repo url: https://github.com/owner/repo
# ☠️ Found malicious signature Obfuscated Javascript (Buffered "child_process") in file /path/to/codebase/malware.js
```

Scan a local codebase:

```bash
# Just scan
npx @mathiscode/codebase-scanner@latest /path/to/codebase
# ☠️ Found malicious signature Obfuscated Javascript (Buffered "child_process") in file /path/to/codebase/malware.js
```

```bash
# Scan and fix
npx @mathiscode/codebase-scanner@latest --fix /path/to/codebase
# ☠️ Found malicious signature Obfuscated Javascript (Buffered "child_process") in file /path/to/codebase/malware.js
# ⚠️ Detected and modified file /path/to/codebase/malware.js - review immediately
```

Scan all dependencies of a project:

```bash
npx @mathiscode/codebase-scanner@latest --deps /path/to/codebase/package.json
```

Scan an [npm](https://www.npmjs.com/) package:

```bash
npx @mathiscode/codebase-scanner@latest --npm package-name
# ☠️ Found malicious signature Obfuscated Javascript (Buffered "child_process") in file /path/to/codebase/malware.js
```

## Exit Codes

The tool will exit with a non-zero exit code if malicious code is found. This can be used to fail CI pipelines.

Exit Codes:

- `0`: No malicious code found
- `1`: Malicious code found
- `2`: Error

## JSON Output

The tool can output a JSON array of detections. This can be used in more complex flows.

```bash
npx @mathiscode/codebase-scanner@latest --json /path/to/codebase
```

## Malicious File Header

When a file is fixed, the following header is prepended to the file:

<pre>
========= MALICIOUS =========
This file has been flagged as malicious by https://github.com/mathiscode/codebase-scanner
Please review the file and remove these lines if appropriate.
========= MALICIOUS =========
</pre>
