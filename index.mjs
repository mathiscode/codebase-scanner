#!/usr/bin/env node

/**
 * Codebase Scanner by Jay Mathis
 * https://github.com/mathiscode/codebase-scanner
 * 
 * Scan a folder, repository, npm/pypi package, or dependencies for malicious signatures.
**/

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { realpathSync } from 'node:fs'

import chalk from 'chalk'
import { program } from 'commander'
import { x } from 'tar'

import Signatures from './signatures/index.mjs'

let packageJSON = { version: 'unknown' }
try {
  const packagePath = new URL('./package.json', import.meta.url).pathname
  packageJSON = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
} catch (error) {
  console.warn(chalk.yellow(`Warning: Could not read version from codebase-scanner's package.json: ${error.message}`))
}

const maliciousHeader = `
========= MALICIOUS ========= \u0000\u001F\uFFFE\uFFFF\u200B\u2028\u2029\uD800\uDC00
This file has been flagged as malicious by https://github.com/mathiscode/codebase-scanner
Please review the file and remove these lines if appropriate.
========= MALICIOUS ========= \u0000\u001F\uFFFE\uFFFF\u200B\u2028\u2029\uD800\uDC00
`

program
  .version(packageJSON.version || 'unknown')
  .description('Scan a folder, repository, npm/pypi package, or dependencies for malicious signatures.')

program
  .command('local [folder]')
  .description('Scan a local folder (defaults to current directory)')
  .option('-f, --fix', 'Fix the files by injecting plain text (default: only scan and report)')
  .option('-a, --all', 'Scan all files with all signatures (default: only scan matching extensions)')
  .option('-l, --limit <size>', 'Set the file size limit in bytes', '1000000') // Default to 1MB
  .option('-j, --json', 'Output results in JSON format')
  .action(runLocalScan)

program
  .command('npm <package>')
  .description('Download and scan an npm package')
  .option('-a, --all', 'Scan all files with all signatures (default: only scan matching extensions)')
  .option('-l, --limit <size>', 'Set the file size limit in bytes', '1000000')
  .option('-j, --json', 'Output results in JSON format')
  .action(runNpmScan)

program
  .command('pypi <package>')
  .description('Download and scan a PyPI package')
  .option('-a, --all', 'Scan all files with all signatures (default: only scan matching extensions)')
  .option('-l, --limit <size>', 'Set the file size limit in bytes', '1000000')
  .option('-j, --json', 'Output results in JSON format')
  .action(runPypiScan)

program
  .command('deps <path>')
  .description('Scan dependencies specified in a directory (package.json/requirements.txt)')
  .option('-a, --all', 'Scan all files with all signatures (default: only scan matching extensions)')
  .option('-l, --limit <size>', 'Set the file size limit in bytes', '1000000')
  .option('-j, --json', 'Output results in JSON format')
  .action(runDepsScan)

/*
  Iterate over all files in a folder and scan them for malicious code.
*/
export async function iterateFiles(folder, options) {
  const { json: jsonOutput, all } = options
  if (!fs.existsSync(folder)) return console.error(`Invalid path: ${folder}`)
  const files = fs.readdirSync(folder)
  const promises = []

  for (const file of files) {
    const filePath = path.join(folder, file)
    if (path.basename(filePath) === 'node_modules') {
      if (!jsonOutput) console.log(chalk.gray(`Skipping node_modules directory: ${filePath}`))
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
      promises.push(iterateFiles(filePath, options))
    } else {
      const extension = path.extname(filePath)
      const signatures = all ? Signatures : Signatures.filter(s => s.extensions.includes(extension?.replace('.', '').toLowerCase()))

      if (signatures.length > 0) {
        promises.push((async () => {
          try {
            return await scanFile(filePath, signatures, options)
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

/*
  Scan a file for malicious code.
*/
export async function scanFile(file, signatures, options) {
  const { limit, fix, json: jsonOutput } = options
  const stat = await fs.promises.stat(file)
  if (stat.size > limit) return

  let data = await fs.promises.readFile(file, 'utf-8')
  let index = -1
  let trigger
  let triggerLevel

  for (const { name, signature, level, regex } of signatures) {
    if (trigger) break

    const pattern = regex ? signature : signature.replace(/[.*+?^${}()|[\\\]]/g, '\\$&')
    const signatureRegex = new RegExp(pattern, 'g')

    if (signatureRegex.test(data)) {
      index = signatures.findIndex(s => s.signature === signature)
      triggerLevel = level
      trigger = name
      if (fix) await fs.promises.writeFile(file, `${maliciousHeader}${data}`)
      if (level === 'malicious') break
    }
  }

  if (!jsonOutput) {
    if (trigger && triggerLevel === 'malicious') {
      console.log(chalk.white(`☠️  Found malicious signature #${index} - ${chalk.bgRed(trigger)} in file ${chalk.bgRed(file)}`))
      if (fix) console.log(chalk.white(`🚨 Detected and modified malicious file ${chalk.bgRed(file)} - review immediately`))
    } else if (trigger && triggerLevel === 'warning') {
      console.log(chalk.white(`⚠️  Found suspicious signature #${index} - ${chalk.bgYellow(trigger)} in file ${chalk.bgYellow(file)}`))
    }
  }

  data = undefined
  return { file, triggered: Boolean(trigger), level: triggerLevel, index, name: trigger || null }
}

/*
  Scan all dependencies specified in a directory (package.json or requirements.txt).
*/
export async function scanDependencies(dependencyDir, options) {
  const { json: jsonOutput } = options
  if (!jsonOutput) console.log(chalk.blue(`Scanning dependencies in directory: ${dependencyDir}`))

  if (!fs.existsSync(dependencyDir)) {
    throw new Error(`Directory not found: ${dependencyDir}`)
  }

  const packageJsonPath = path.join(dependencyDir, 'package.json')
  const requirementsPath = path.join(dependencyDir, 'requirements.txt')

  const hasPackageJson = fs.existsSync(packageJsonPath)
  const hasRequirementsTxt = fs.existsSync(requirementsPath)

  if (!hasPackageJson && !hasRequirementsTxt) {
    if (!jsonOutput) console.log(chalk.yellow(`No package.json or requirements.txt found in ${dependencyDir}`))
    return []
  }

  let allResults = []
  let errors = []

  if (hasPackageJson) {
    try {
      const npmResults = await scanNpmDependencies(dependencyDir, options)
      if (npmResults) allResults.push(...npmResults)
    } catch (error) {
      errors.push(error)
    }
  }

  if (hasRequirementsTxt) {
    try {
      const pypiResults = await scanPypiDependencies(dependencyDir, options)
      if (pypiResults) allResults.push(...pypiResults)
    } catch (error) {
      errors.push(error)
    }
  }

  if (errors.length > 0) {
    console.error(chalk.red(`Encountered ${errors.length} errors during dependency scanning.`))
    throw errors[0]
  }

  return allResults
}

/*
  Scan an npm package.
*/
export async function scanNpmPackage(packageName, options) {
  const { json: jsonOutput } = options
  let tempDir
  if (!jsonOutput) console.log(chalk.blue(`Attempting to scan npm package: ${packageName}`))

  try {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'codebase-scanner-'))
    if (!jsonOutput) console.log(chalk.blue(`Created temporary directory: ${tempDir}`))

    if (!jsonOutput) console.log(chalk.blue(`Downloading package '${packageName}'...`))
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
    if (!jsonOutput) console.log(chalk.blue(`Downloaded ${tarball}`))

    const extractDir = path.join(tempDir, 'package')
    await fs.promises.mkdir(extractDir)
    if (!jsonOutput) console.log(chalk.blue(`Extracting ${tarball} to ${extractDir}...`))
    await x({ file: tarballPath, cwd: extractDir, strip: 1 })

    if (!jsonOutput) console.log(chalk.blue(`Scanning extracted package content...`))
    return await iterateFiles(extractDir, options)
  } catch (error) {
    console.error(chalk.red(`An error occurred during npm package scanning: ${error.message}`))
  } finally {
    if (tempDir) {
      if (!jsonOutput) console.log(chalk.blue(`Cleaning up temporary directory: ${tempDir}`))
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true })
      } catch (rmErr) {
        console.error(chalk.yellow(`Warning: Failed to clean up temp directory ${tempDir}: ${rmErr.message}`))
      }
    }
  }
}

/*
  Scan a PyPI package.
*/
export async function scanPypiPackage(packageName, options) {
  const { json: jsonOutput } = options
  let tempDir
  if (!jsonOutput) console.log(chalk.blue(`Attempting to scan PyPI package: ${packageName}`))

  try {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'codebase-scanner-pypi-'))
    if (!jsonOutput) {
      console.log(chalk.blue(`Created temporary directory: ${tempDir}`))
      console.log(chalk.blue(`Downloading package '${packageName}'...`))
    }

    try {
      execSync(`python3 -m pip download ${packageName} --no-deps -d "${tempDir}"`, { stdio: 'pipe' })
    } catch (error) {
      console.error(chalk.red(`Error downloading package '${packageName}': ${error.stderr?.toString() || error.message}`))
      if (error.message.includes('command not found') || error.stderr?.toString().includes('command not found')) {
        console.error(chalk.yellow('Please ensure Python3 and Pip are installed and available in your PATH.'))
      }
      throw error
    }

    const files = await fs.promises.readdir(tempDir)
    const downloadedFile = files[0]
    if (!downloadedFile) throw new Error(`Could not find downloaded package file for ${packageName} in ${tempDir}`)
    const downloadedFilePath = path.join(tempDir, downloadedFile)
    if (!jsonOutput) console.log(chalk.blue(`Downloaded ${downloadedFile}`))

    const extractDir = path.join(tempDir, 'package')
    await fs.promises.mkdir(extractDir)
    if (!jsonOutput) console.log(chalk.blue(`Extracting ${downloadedFile} to ${extractDir}...`))

    if (downloadedFile.endsWith('.whl') || downloadedFile.endsWith('.zip')) {
      try {
        execSync(`unzip "${downloadedFilePath}" -d "${extractDir}"`, { stdio: 'pipe' })
      } catch (error) {
        console.error(chalk.red(`Error extracting ${downloadedFile} with unzip: ${error.stderr?.toString() || error.message}`))
        if (error.message.includes('command not found') || error.stderr?.toString().includes('command not found')) {
          console.error(chalk.yellow('Please ensure the unzip command is installed and available in your PATH.'))
        }
        throw error
      }
    } else if (downloadedFile.endsWith('.tar.gz')) {
      try {
        await x({ file: downloadedFilePath, cwd: extractDir, strip: 1 })
      } catch (error) {
        console.error(chalk.red(`Error extracting ${downloadedFile} with tar: ${error.message}`))
        throw error
      }
    } else {
      throw new Error(`Unsupported package format: ${downloadedFile}`)
    }

    if (!jsonOutput) console.log(chalk.blue(`Scanning extracted package content...`))
    return await iterateFiles(extractDir, options)
  } catch (error) {
    console.error(chalk.red(`An error occurred during PyPI package scanning: ${error.message}`))
  } finally {
    if (tempDir) {
      if (!jsonOutput) console.log(chalk.blue(`Cleaning up temporary directory: ${tempDir}`))
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true })
      } catch (rmErr) {
        console.error(chalk.yellow(`Warning: Failed to clean up temp directory ${tempDir}: ${rmErr.message}`))
      }
    }
  }
}

/*
  Scan all npm dependencies in a package.json file.
*/
export async function scanNpmDependencies(packageJsonDir, options) {
  const { json: jsonOutput } = options
  const packageJsonPath = path.join(packageJsonDir, 'package.json')
  if (!jsonOutput) console.log(chalk.blue(`Scanning npm dependencies from: ${packageJsonPath}`))
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
      if (!jsonOutput) console.log(chalk.yellow(`No npm dependencies found in ${packageJsonPath}`))
      return []
    }

    if (!jsonOutput) console.log(chalk.blue(`Found ${dependencyNames.length} npm dependencies/devDependencies to scan.`))
    const allResults = []

    for (const depName of dependencyNames) {
      const depVersion = dependencies[depName]
      const fullDepName = depVersion.startsWith('file:') || depVersion.startsWith('link:') || depVersion.startsWith('/')
        ? depName // Avoid trying to npm pack local file/link dependencies
        : `${depName}` // Could add `@${depVersion}` but npm pack usually fetches latest/specified by registry

      if (fullDepName !== depName) {
        if (!jsonOutput) console.log(chalk.gray(`Skipping local npm dependency: ${depName} (${depVersion})`))
        continue
      }

      try {
        const results = await scanNpmPackage(fullDepName, options)
        if (results) allResults.push(...results)
      } catch (error) {
        console.error(chalk.red(`Failed to scan npm dependency ${fullDepName}: ${error.message}`))
      }
      if (!jsonOutput) console.log(chalk.blue("----------------------------------------"))
    }
    return allResults
  } catch (error) {
    console.error(chalk.red(`Error processing npm dependencies from ${packageJsonPath}: ${error.message}`))
    throw error
  }
}

/*
  Scan all PyPI dependencies in a requirements.txt file.
*/
export async function scanPypiDependencies(requirementsDir, options) {
  const { json: jsonOutput } = options
  const requirementsPath = path.join(requirementsDir, 'requirements.txt')
  if (!jsonOutput) console.log(chalk.blue(`Scanning PyPI dependencies from: ${requirementsPath}`))

  try {
    if (!fs.existsSync(requirementsDir)) {
      throw new Error(`Directory not found: ${requirementsDir}`)
    }
    if (!fs.existsSync(requirementsPath)) {
      throw new Error(`requirements.txt not found in: ${requirementsDir}`)
    }

    const requirementsContent = await fs.promises.readFile(requirementsPath, 'utf-8')
    const lines = requirementsContent.split('\n')

    const dependencyNames = lines
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => line.split(/[=<>~]/)[0].trim())
      .filter(Boolean)

    if (dependencyNames.length === 0) {
      if (!jsonOutput) console.log(chalk.yellow(`No PyPI dependencies found in ${requirementsPath}`))
      return []
    }

    if (!jsonOutput) console.log(chalk.blue(`Found ${dependencyNames.length} PyPI dependencies to scan.`))
    const allResults = []

    for (const depName of dependencyNames) {
      if (depName.startsWith('-')) {
        if (!jsonOutput) console.log(chalk.gray(`Skipping line in requirements.txt: ${depName}`))
        continue
      }
      try {
        const results = await scanPypiPackage(depName, options)
        if (results) allResults.push(...results)
      } catch (error) {
        console.error(chalk.red(`Failed to scan PyPI dependency ${depName}: ${error.message}`))
      }
      if (!jsonOutput) console.log(chalk.blue("----------------------------------------"))
    }
    return allResults
  } catch (error) {
    console.error(chalk.red(`Error processing PyPI dependencies from ${requirementsPath}: ${error.message}`))
    throw error
  }
}

/*
  Wrapper functions for command actions
*/
export async function runScan(scanFunction, target, options) {
  try {
    const results = await scanFunction(target, options)
    const flatResults = deepFlatten(Array.isArray(results) ? results : [])
    const detections = flatResults.filter(r => r && typeof r === 'object' && r.triggered)
    const exitCode = detections.some(r => r.level === 'malicious') ? 1 : 0

    if (options.json) {
      console.log(JSON.stringify(detections, null, 2))
    } else if (detections.length === 0) {
      console.log(chalk.green('✅ No malicious or suspicious signatures found.'))
    }

    process.exit(exitCode)
  } catch (error) {
    console.error(chalk.red(`An unexpected error occurred: ${error.message}`))
    process.exit(2)
  }
}

export async function runLocalScan(folder, options) {
  const targetFolder = folder || process.cwd()
  const combinedOptions = { ...program.opts(), ...options }
  await runScan(iterateFiles, targetFolder, combinedOptions)
}

export async function runNpmScan(packageName, options) {
  const combinedOptions = { ...program.opts(), ...options }
  await runScan(scanNpmPackage, packageName, combinedOptions)
}

export async function runPypiScan(packageName, options) {
  const combinedOptions = { ...program.opts(), ...options }
  await runScan(scanPypiPackage, packageName, combinedOptions)
}

export async function runDepsScan(dirPath, options) {
  const combinedOptions = { ...program.opts(), ...options }
  await runScan(scanDependencies, dirPath, combinedOptions)
}

/*
  Utility function to flatten our results
*/
export function deepFlatten(arr) {
  return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(deepFlatten(val)) : acc.concat(val), [])
}

// Determine if the script is the main module being run
const isMainScript = (() => {
  try {
    const mainScriptPath = realpathSync(process.argv[1])
    const currentScriptPath = fileURLToPath(import.meta.url)
    return mainScriptPath === currentScriptPath
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
        console.warn(chalk.yellow(`Warning: Could not determine main script path: ${error.message}`))
    }
    return false
  }
})()

if (isMainScript) {
  program.parse(process.argv)
  const commandSpecified = program.args.length > 0 && program.commands.some(cmd => cmd.name() === program.args[0])
  if (!commandSpecified && process.argv.length <= 2) {
    program.outputHelp()
  } else if (!commandSpecified && program.args.length === 0 && process.argv.length > 2) {
    const hasCommandArg = program.args.some(arg => program.commands.some(cmd => cmd.name() === arg))
    if (!hasCommandArg) program.outputHelp()
  } else if (program.args.length === 0 && !commandSpecified) {
    program.outputHelp()
  }
}
