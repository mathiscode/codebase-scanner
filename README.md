<!-- markdownlint-disable MD033 -->

# Codebase Scanner

[npm](https://www.npmjs.com/package/@mathiscode/codebase-scanner)

A quick and dirty tool to help defend against common developer-focused malware campaigns since many of these go unnoticed by common antivirus software.

When a signature is found, the filename is printed to the console and optionally fixed (if `--fix` is passed). When fixing, a header is prepended to the file to prevent the malware from running or being imported. This may not be foolproof, so always exercise caution and do everything possible to avoid letting the codebase run any scripts.

Inspired by [this experience](https://www.reddit.com/r/Upwork/comments/14nat71/scam_warning_blockchain_developer_job_postings) (obfuscated Javascript steals your browser profiles and other files via a "test task" on freelancing sites, hidden within a seemingly innocuous codebase).

Currently the signatures only target this specific type of Javascript malware, but more will be added over time. Signatures may be added for other file types as well.

**PRs welcome!**

Have you found a new signature? Please submit a PR with the signature added to [`signatures.js`](signatures.js) and a sample file attached in a comment.

## Usage

Scan a repository in a Docker container:

```bash
docker run -it --rm mathiscode/codebase-scanner
# Enter the repo url: https://github.com/owner/repo
# ☠️ Found signature Obfuscated Javascript (Buffered "child_process") in file /path/to/codebase/malware.js
```

Scan a local codebase:

```bash
# Just scan
npx @mathiscode/codebase-scanner@latest /path/to/codebase
# ☠️ Found signature Obfuscated Javascript (Buffered "child_process") in file /path/to/codebase/malware.js
```

```bash
# Scan and fix
npx @mathiscode/codebase-scanner@latest --fix /path/to/codebase
# ☠️ Found signature Obfuscated Javascript (Buffered "child_process") in file /path/to/codebase/malware.js
# ✅ Fixed file /path/to/codebase/malware.js
```

## Malicious File Header

When a file is fixed, the following header is prepended to the file:

<pre>
======== MALICIOUS ========
This file has been flagged as malicious by https://github.com/mathiscode/codebase-scanner
Please review the file and remove these lines if appropriate.
======== MALICIOUS ========
</pre>
