/**
 * This script scans the NPM registry for packages that are potentially malicious.
 * It can stop/resume from the last scanned package.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { EOL } from 'node:os'
import { DatabaseSync } from 'node:sqlite'

import allPackageNames from 'all-the-package-names' with { type: 'json' }
import { scanNpmPackage, deepFlatten } from '../index.mjs'

const logDir = path.join(os.tmpdir(), 'codebase-scanner-npm-registry-results')
const errorLogFilePath = path.join(logDir, 'codebase-scanner-npm-registry-scan-error.log')
const dbPath = path.join(logDir, 'codebase-scanner-npm-registry.sqlite')

fs.mkdirSync(logDir, { recursive: true })

let db
try {
  db = new DatabaseSync(dbPath)
  console.log(`Using SQLite database at: ${dbPath}`)
  db.exec(`
    CREATE TABLE IF NOT EXISTS scan_results (
      name TEXT PRIMARY KEY,
      scanned_at INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('scanned', 'skipped', 'error')),
      findings_json TEXT,
      error_message TEXT,
      files_scanned INTEGER,
      detections_count INTEGER
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_scanned_at ON scan_results(scanned_at);
  `)
} catch (dbError) {
  console.error(`FATAL: Could not open or initialize SQLite database at ${dbPath}:`, dbError)
  fs.appendFileSync(errorLogFilePath, `FATAL DB Error: ${dbError.message}${EOL}${dbError.stack}${EOL}`, { encoding: 'utf-8' })
  process.exit(1)
}

async function appendToErrorLog(message) {
  try {
    await fs.promises.appendFile(errorLogFilePath, `${new Date().toISOString()}: ${message}${EOL}`)
  } catch (error) {
    console.error(`FATAL: Could not write to error log file ${errorLogFilePath}:`, error)
  }
}

let insertStmt
let updateStmt
try {
  insertStmt = db.prepare(`
    INSERT INTO scan_results (name, scanned_at, status, findings_json, error_message, files_scanned, detections_count)
    VALUES (:name, :scanned_at, :status, :findings_json, :error_message, :files_scanned, :detections_count)
    ON CONFLICT(name) DO NOTHING;
  `)

  updateStmt = db.prepare(`
    UPDATE scan_results
    SET scanned_at = :scanned_at,
        status = :status,
        findings_json = :findings_json,
        error_message = :error_message,
        files_scanned = :files_scanned,
        detections_count = :detections_count
    WHERE name = :name;
  `)
} catch (dbError) {
    console.error(`FATAL: Could not prepare database statements:`, dbError)
    await appendToErrorLog(`FATAL DB Prepare Error: ${dbError.message}${EOL}${dbError.stack}`)
    process.exit(1)
}

function logScanResultToDb(result) {
  const params = {
    name: result.name,
    scanned_at: result.scanned_at || Math.floor(Date.now() / 1000),
    status: result.status,
    findings_json: result.findings_json || null,
    error_message: result.error_message || null,
    files_scanned: result.files_scanned != null ? result.files_scanned : null,
    detections_count: result.detections_count != null ? result.detections_count : null
  }

  try {
    const updateResult = updateStmt.run(params)
    if (updateResult.changes === 0) {
      insertStmt.run(params)
    }
  } catch (dbError) {
    console.error(`Error logging result for package ${result.name} to database:`, dbError)
    appendToErrorLog(`DB Insert/Update Error for ${result.name}: ${dbError.message}`)
  }
}

async function getLastScannedPackage() {
  try {
    const query = db.prepare('SELECT name FROM scan_results ORDER BY scanned_at DESC LIMIT 1')
    const result = query.get()
    if (result) {
      console.log(`Found last scanned package in database: ${result.name}`)
      return result.name
    } else {
      console.log('No previous scan results found in the database.')
      return null
    }
  } catch (error) {
    console.error('Error querying database for last scanned package:', error)
    await appendToErrorLog(`DB Query Error (getLastScannedPackage): ${error.message}`)
    return null
  }
}

async function main() {
  console.log('Starting NPM registry scan...')
  console.log(`Critical errors will be logged to: ${errorLogFilePath}`)

  const lastScanned = await getLastScannedPackage()
  const packageNames = allPackageNames.filter(name => name === name.toLowerCase() && name && !name.startsWith('-') && !name.includes('/'))
  const totalPackages = packageNames.length
  console.log(`Total valid lowercase packages found: ${totalPackages}`)

  let startIndex = 0
  if (lastScanned) {
    const foundIndex = packageNames.indexOf(lastScanned)
    if (foundIndex !== -1) {
      startIndex = foundIndex + 1
      console.log(`Resuming scan from package: ${packageNames[startIndex]} (index ${startIndex})`)
    } else {
      console.log(`Last scanned package "${lastScanned}" not found in current filtered package list. Starting from the beginning.`)
      await appendToErrorLog(`Resuming Warning: Last scanned package "${lastScanned}" not found in filtered list. Restarting scan.`)
    }
  } else {
    console.log('No previous scan detected in DB or list empty. Starting from the beginning.')
  }

  console.log(`Scanning packages from index ${startIndex} to ${totalPackages - 1}`)

  const scanOptions = {
    json: true,
    limit: '1000000',
    all: false
  }

  for (let i = startIndex; i < totalPackages; i++) {
    const packageName = packageNames[i]

    console.log(`[${i + 1}/${totalPackages}] Scanning: ${packageName}`)
    let scanResultsArray
    let scanError = null
    let filesScanned = 0
    let detections = []
    let detectionCounts = {}
    let findingsJson = null

    try {
      scanResultsArray = await scanNpmPackage(packageName, scanOptions)
      const flatResults = deepFlatten(Array.isArray(scanResultsArray) ? scanResultsArray : []).filter(r => r && typeof r === 'object')

      filesScanned = flatResults.length
      detections = flatResults.filter(r => r.triggered)

      for (const det of detections) {
        detectionCounts[det.name] = (detectionCounts[det.name] || 0) + 1
      }

      if (filesScanned > 0) {
        findingsJson = JSON.stringify(flatResults)
      }

      if (detections.length > 0) {
        const summary = Object.entries(detectionCounts).map(([type, count]) => `${type}: ${count}`).join(', ')
        console.log(`[${i + 1}/${totalPackages}] 🚨 Findings for ${packageName}: ${summary} (Files scanned: ${filesScanned})`)
      } else if (filesScanned > 0) {
        console.log(`[${i + 1}/${totalPackages}] ✅ No findings for ${packageName} (Files scanned: ${filesScanned})`)
      } else {
        console.log(`[${i + 1}/${totalPackages}] 🤔 No files scanned or empty results for ${packageName}`)
        findingsJson = null
      }

      logScanResultToDb({
        name: packageName,
        status: 'scanned',
        findings_json: findingsJson,
        error_message: null,
        files_scanned: filesScanned,
        detections_count: detections.length
      })

    } catch (error) {
      scanError = error
      console.error(`[${i + 1}/${totalPackages}] ❌ Error scanning package ${packageName}:`, error.message)
      await appendToErrorLog(`Scan Error for ${packageName}: ${error.message}`)
      logScanResultToDb({
        name: packageName,
        status: 'error',
        findings_json: null,
        error_message: error.message || 'Unknown error during scanNpmPackage call',
        files_scanned: null,
        detections_count: null
      })
    }
  }

  console.log('NPM registry scan completed.')
  try {
    db.close()
    console.log('Database connection closed.')
  } catch(closeError) {
    console.error('Error closing database:', closeError)
    await appendToErrorLog(`DB Close Error: ${closeError.message}`)
  }
}

main().catch(async error => {
  console.error('Unhandled error during scan initiation or loop:', error)
  await appendToErrorLog(`FATAL UNHANDLED ERROR: ${error.message}${EOL}${error.stack}`)
  if (db && db.isOpen) {
    try { db.close() } catch(e) { /* ignore closing error if already failed */ }
  }
  process.exit(1)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing database connection...')
  if (db && db.isOpen) {
    try { db.close() } catch(e) { console.error('Error closing DB on SIGINT:', e)}
  }
  process.exit(0)
})
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connection...')
  if (db && db.isOpen) {
    try { db.close() } catch(e) { console.error('Error closing DB on SIGTERM:', e)}
  }
  process.exit(0)
})
