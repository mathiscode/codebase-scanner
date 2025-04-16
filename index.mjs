#!/usr/bin/env node

/**
 * Codebase Scanner by Jay Mathis
 * https://github.com/mathiscode/codebase-scanner
 * 
 * This script scans a folder for files containing malicious code signatures.
**/

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync } from 'node:child_process'

import chalk from 'chalk'
import { program } from 'commander'
import { x } from 'tar'

import Signatures from './signatures.js'

program
  .argument('[folder]', 'The folder to scan')
  .option('-n, --npm <package>', 'Specify an npm package name to download and scan')
  .option('-f, --fix', 'Fix the files by injecting plain text to prevent the file from running or being imported (default: only scan and report)')
  .option('-a, --all', 'Scan all files with all signatures (default: only scan files with matching extensions)')
  .option('-l, --limit <size>', 'Set the file size limit in bytes (default: 1,000,000)', 1e6)
  .parse(process.argv)

const { fix, all, limit, npm: npmPackageName } = program.opts()
const folderPath = program.args[0]
const maliciousHeader = `
========= MALICIOUS ========= \u0000\u001F\uFFFE\uFFFF\u200B\u2028\u2029\uD800\uDC00
This file has been flagged as malicious by https://github.com/mathiscode/codebase-scanner
Please review the file and remove these lines if appropriate.
========= MALICIOUS ========= \u0000\u001F\uFFFE\uFFFF\u200B\u2028\u2029\uD800\uDC00
`

if ((!folderPath && !npmPackageName) || (folderPath && npmPackageName)) {
  console.error(chalk.red('Error: Please provide either a folder path OR an npm package name using --npm, but not both.'))
  program.help()
  process.exit(1)
}

async function iterateFiles(folder) {
  if (!fs.existsSync(folder)) return console.error(`Invalid path: ${folder}`)
  const files = fs.readdirSync(folder)
  const promises = [] // Collect promises

  for (const file of files) {
    const filePath = path.join(folder, file)
    if (path.basename(filePath) === 'node_modules') {
      console.log(chalk.gray(`Skipping node_modules directory: ${filePath}`))
      continue;
    }

    let stat
    try {
      stat = fs.statSync(filePath)
    } catch (err) {
      console.error(chalk.yellow(`Warning: Could not stat file ${filePath}: ${err.message}`))
      continue
    }

    if (stat.isDirectory()) {
      promises.push(iterateFiles(filePath))
    } else {
      const extension = path.extname(filePath)
      const signatures = all ? Signatures : Signatures.filter(s => s.extensions.includes(extension?.replace('.', '').toLowerCase()))

      if (signatures.length > 0) {
        promises.push((async () => {
          try {
            await scanFile(filePath, signatures)
          } catch (err) {
            console.error(chalk.yellow(`Warning: Error scanning file ${filePath}: ${err.message}`))
          }
        })())
      }
    }
  }
  await Promise.allSettled(promises)
}

async function scanFile(file, signatures) {
  const stat = await fs.promises.stat(file)
  if (stat.size > limit) return
  let data = await fs.promises.readFile(file, 'utf-8')

  let trigger
  for (const { name, signature, level, regex } of signatures) {
    if (trigger) break

    const pattern = regex ? signature : signature.replace(/[.*+?^${}()|[\\\]]/g, '\\$&')
    const signatureRegex = new RegExp(pattern, 'g')

    if (signatureRegex.test(data)) {
      if (level === 'warning') {
        console.log(chalk.yellow(`⚠️  Found suspicious signature ${chalk.bgYellow(name)} in file ${chalk.bgYellow(file)}`))
      } else {
        trigger = name
        if (fix) {
          await fs.promises.writeFile(file, `${maliciousHeader}${data}`)
        }
        break;
      }
    }
  }

  if (trigger) console.log(chalk.red(`☠️  Found malicious signature ${chalk.bgRed(trigger)} in file ${chalk.bgRed(file)}`))
  if (trigger && fix) console.log(chalk.red(`🚨 Detected and modified malicious file ${chalk.bgRed(file)} - review immediately`))
  data = undefined
}

async function scanNpmPackage(packageName) {
  let tempDir
  console.log(chalk.blue(`Attempting to scan npm package: ${packageName}`))

  try {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'codebase-scanner-'))
    console.log(chalk.blue(`Created temporary directory: ${tempDir}`))

    console.log(chalk.blue(`Downloading package '${packageName}'...`))
    try {
      execSync(`npm pack ${packageName} --pack-destination "${tempDir}"`, { stdio: 'pipe' })
    } catch (error) {
      console.error(chalk.red(`Error downloading package '${packageName}': ${error.stderr?.toString() || error.message}`))
      throw error
    }

    const files = await fs.promises.readdir(tempDir)
    const tarball = files.find(f => f.endsWith('.tgz'))
    if (!tarball) throw new Error(`Could not find downloaded tarball for ${packageName} in ${tempDir}`)
    const tarballPath = path.join(tempDir, tarball)
    console.log(chalk.blue(`Downloaded ${tarball}`))

    const extractDir = path.join(tempDir, 'package')
    await fs.promises.mkdir(extractDir)
    console.log(chalk.blue(`Extracting ${tarball} to ${extractDir}...`))
    await x({ file: tarballPath, cwd: extractDir, strip: 1 })

    console.log(chalk.blue(`Scanning extracted package content...`))
    await iterateFiles(extractDir)
  } catch (error) {
    console.error(chalk.red(`An error occurred during npm package scanning: ${error.message}`))
  } finally {
    if (tempDir) {
      console.log(chalk.blue(`Cleaning up temporary directory: ${tempDir}`))
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true })
      } catch (rmErr) {
        console.error(chalk.yellow(`Warning: Failed to clean up temp directory ${tempDir}: ${rmErr.message}`))
      }
    }
  }
}

async function main() {
  try {
    if (npmPackageName) await scanNpmPackage(npmPackageName)
    else if (folderPath) await iterateFiles(folderPath)
  } catch (error) {
    console.error(chalk.red(`An unexpected error occurred in main execution: ${error.message}`))
    process.exit(1)
  }
}

try { main() } catch (error) {
  console.error(`An error occurred: ${error.message}`)
  process.exit(1)
}
