#!/usr/bin/env node

/**
 * Codebase Scanner by Jay Mathis
 * https://github.com/mathiscode/codebase-scanner
 * 
 * This script scans a folder for files containing malicious code signatures.
**/

import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import { program } from 'commander'

import Signatures from './signatures.js'

program
  .argument('<folder>', 'The folder to scan')
  .option('-f, --fix', 'Fix the files by injecting plain text to prevent the file from running or being imported (default: only scan and report)')
  .option('-a, --all', 'Scan all files with all signatures (default: only scan files with matching extensions)')
  .option('-l, --limit <size>', 'Set the file size limit in bytes (default: 1,000,000)', 1e6)
  .parse(process.argv)

const folderPath = program.args[0]
const { fix, all, limit } = program.opts()
const maliciousHeader = '========= MALICIOUS =========\nThis file has been flagged as malicious by https://github.com/mathiscode/codebase-scanner\nPlease review the file and remove these lines if appropriate.\n========= MALICIOUS =========\n\n\n\n'

if (!folderPath) {
  console.error('Please provide a folder as the first command-line argument.')
  process.exit(1)
}

async function iterateFiles(folder) {
  if (!fs.existsSync(folder)) return console.error(`Invalid path: ${folder}`)
  const files = fs.readdirSync(folder)

  for (const file of files) {
    const filePath = path.join(folder, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) iterateFiles(filePath)
    else {
      const extension = path.extname(filePath)
      const signatures = all ? Signatures : Signatures.filter(s => s.extensions.includes(extension?.replace('.', '').toLowerCase()))

      try {
        if (signatures.length > 0) scanFile(filePath, signatures)
      } catch (err) {
        console.error(chalk.warn(`Error scanning file ${filePath}: ${err.message}`))
      }
    }
  }
}

async function scanFile(file, signatures) {
  const stat = await fs.promises.stat(file)
  if (stat.size > limit) return // console.log(chalk.yellow('File too large:', file))
  let data = await fs.promises.readFile(file, 'utf-8')
  // console.log(chalk.blue(`Scanning: ${file} with ${signatures.length} signature(s)...`))

  let trigger
  for (const { name, signature, level } of signatures) {
    if (trigger) break
    const regex = new RegExp(signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')

    if (regex.test(data)) {
      if (level === 'warning') return console.log(chalk.yellow(`⚠️  Found suspicious signature ${chalk.bgYellow(name)} in file ${chalk.bgYellow(file)}`))

      trigger = name
      if (fix) fs.promises.writeFile(file, `${maliciousHeader}${data}`)
    }
  }

  if (trigger) console.log(chalk.red(`☠️  Found malicious signature ${chalk.bgRed(trigger)} in file ${chalk.bgRed(file)}`))
  if (trigger && fix) console.log(chalk.red(`🚨 Detected and modified malicious file ${chalk.bgRed(file)} - review immediately`))
  data = undefined
}

try {
  iterateFiles(folderPath)
} catch (error) {
  console.error(`An error occurred: ${error.message}`)
}
