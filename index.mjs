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
  .option('-d, --deps <path>', 'Specify a path to a directory containing package.json to scan all its dependencies')
  .option('-f, --fix', 'Fix the files by injecting plain text to prevent the file from running or being imported (default: only scan and report)')
  .option('-a, --all', 'Scan all files with all signatures (default: only scan files with matching extensions)')
  .option('-l, --limit <size>', 'Set the file size limit in bytes (default: 1,000,000)', 1e6)
  .parse(process.argv)

const { fix, all, limit, npm: npmPackageName, deps: depsPath } = program.opts()
const folderPath = program.args[0]
const maliciousHeader = `
========= MALICIOUS ========= \u0000\u001F\uFFFE\uFFFF\u200B\u2028\u2029\uD800\uDC00
This file has been flagged as malicious by https://github.com/mathiscode/codebase-scanner
Please review the file and remove these lines if appropriate.
========= MALICIOUS ========= \u0000\u001F\uFFFE\uFFFF\u200B\u2028\u2029\uD800\uDC00
`

const providedArgs = [folderPath, npmPackageName, depsPath].filter(Boolean).length
if (providedArgs === 0) {
  console.error(chalk.red('Error: Please provide a folder path, an npm package name (--npm), or a dependency path (--deps).'))
  program.help()
  process.exit(2)
}

if (providedArgs > 1) {
  console.error(chalk.red('Error: Please provide only one of: a folder path, an npm package name (--npm), or a dependency path (--deps).'))
  program.help()
  process.exit(2)
}

async function iterateFiles(folder) {
  if (!fs.existsSync(folder)) return console.error(`Invalid path: ${folder}`)
  const files = fs.readdirSync(folder)
  const promises = []

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
            return await scanFile(filePath, signatures)
          } catch (err) {
            console.error(chalk.yellow(`Warning: Error scanning file ${filePath}: ${err.message}`))
          }
        })())
      }
    }
  }
  
  const results = await Promise.allSettled(promises)
  return results.filter(r => r.status === 'fulfilled').map(r => r.value)
}

async function scanFile(file, signatures) {
  const stat = await fs.promises.stat(file)
  if (stat.size > limit) return
  let data = await fs.promises.readFile(file, 'utf-8')

  let index = 0
  let trigger
  for (const { name, signature, level, regex } of signatures) {
    if (trigger) break

    const pattern = regex ? signature : signature.replace(/[.*+?^${}()|[\\\]]/g, '\\$&')
    const signatureRegex = new RegExp(pattern, 'g')

    if (signatureRegex.test(data)) {
      index = signatures.findIndex(s => s.signature === signature)
      if (level === 'warning') {
        console.log(chalk.white(`⚠️  Found suspicious signature #${index} - ${chalk.black.bgYellow(name)} in file ${chalk.black.bgYellow(file)}`))
      } else {
        trigger = name
        if (fix) await fs.promises.writeFile(file, `${maliciousHeader}${data}`)
        break
      }
    }
  }

  if (trigger) console.log(chalk.white(`☠️  Found malicious signature #${index} - ${chalk.bgRed(trigger)} in file ${chalk.bgRed(file)}`))
  if (trigger && fix) console.log(chalk.white(`🚨 Detected and modified malicious file ${chalk.bgRed(file)} - review immediately`))
  data = undefined

  return Boolean(trigger)
}

async function scanDependencies(packageJsonDir) {
  const packageJsonPath = path.join(packageJsonDir, 'package.json')
  console.log(chalk.blue(`Scanning dependencies from: ${packageJsonPath}`))
  try {
    if (!fs.existsSync(packageJsonDir)) {
      throw new Error(`Directory not found: ${packageJsonDir}`)
    }
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`package.json not found in: ${packageJsonDir}`)
    }

    const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf-8')
    const packageJson = JSON.parse(packageJsonContent)

    const dependencies = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    }

    const dependencyNames = Object.keys(dependencies)
    if (dependencyNames.length === 0) {
      console.log(chalk.yellow(`No dependencies found in ${packageJsonPath}`))
      return []
    }

    console.log(chalk.blue(`Found ${dependencyNames.length} dependencies/devDependencies to scan.`))
    const allResults = []

    for (const depName of dependencyNames) {
      // Construct package name with version if available, though scanNpmPackage might not use the version
      const depVersion = dependencies[depName]
      const fullDepName = depVersion.startsWith('file:') || depVersion.startsWith('link:') || depVersion.startsWith('/')
        ? depName // Avoid trying to npm pack local file/link dependencies
        : `${depName}` // Could add `@${depVersion}` but npm pack usually fetches latest/specified by registry

      if (fullDepName !== depName) {
        console.log(chalk.gray(`Skipping local dependency: ${depName} (${depVersion})`))
        continue
      }

      try {
        const results = await scanNpmPackage(fullDepName)
        allResults.push(...results)
      } catch (error) {
        console.error(chalk.red(`Failed to scan dependency ${fullDepName}: ${error.message}`))
        // Continue scanning other dependencies
      }
      console.log(chalk.blue("----------------------------------------"))
    }
    return allResults
  } catch (error) {
    console.error(chalk.red(`Error processing dependencies from ${packageJsonPath}: ${error.message}`))
    throw error // Re-throw to be caught by the main try/catch
  }
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
    return await iterateFiles(extractDir)
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
    let results = []
    if (npmPackageName) {
      results = await scanNpmPackage(npmPackageName)
    } else if (depsPath) {
      results = await scanDependencies(depsPath)
    } else if (folderPath) {
      results = await iterateFiles(folderPath)
    }
    return results
  } catch (error) {
    console.error(chalk.red(`An unexpected error occurred in main execution: ${error.message}`))
    process.exit(2)
  }
}

try {
  const result = await main()
  const exitCode = result.flatMap(r => r).filter(r => typeof r === 'boolean').some(r => r) ? 1 : 0
  process.exit(exitCode)
} catch (error) {
  console.error(`An error occurred: ${error.message}`)
  process.exit(2)
}
