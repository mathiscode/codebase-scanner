/**
 * This script generates the JSON files for the npm page.
 * It reads the scan results from the database and writes the JSON files to the `pages/data/npm` directory.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { promisify } from 'node:util'
import zlib from 'node:zlib'

import allPackageNames from 'all-the-package-names' with { type: 'json' }
import Signatures from '../signatures/index.mjs'

const gzip = promisify(zlib.gzip)

let dbDir = path.resolve(process.cwd(), 'codebase-scanner-npm-registry-results')
if (!fs.existsSync(dbDir)) dbDir = path.resolve(os.tmpdir(), 'codebase-scanner-npm-registry-results')
const dbPath = path.join(dbDir, 'codebase-scanner-npm-registry.sqlite')
const chunkOutputDir = path.resolve(process.cwd(), 'pages/data/npm')

async function generateDetectionChunks() {
  console.log(`Reading scan results from database: ${dbPath}`)
  console.log(`Outputting filtered JSON chunks to: ${chunkOutputDir}`)

  let db
  try {
    if (!fs.existsSync(dbPath)) {
      console.error(`FATAL: Database file not found at ${dbPath}. Run the scan first.`)
      process.exit(1)
    }
    
    fs.mkdirSync(chunkOutputDir, { recursive: true })
    db = new DatabaseSync(dbPath, { readonly: true })
  } catch (dbError) {
    console.error(`FATAL: Could not open SQLite database at ${dbPath} or create output directory:`, dbError)
    process.exit(1)
  }

  let allDetections = []
  let totalPackages = 0
  try {
    const query = db.prepare(`
      SELECT name, detections_count, scanned_at, status, files_scanned, findings_json
      FROM scan_results
      WHERE detections_count > 0 AND status = 'scanned'
      ORDER BY name ASC;
    `)

    allDetections = query.all()
    console.log(`Found ${allDetections.length} packages with detections > 0.`)

    const queryTotal = db.prepare(`
      SELECT COUNT(*) as totalPackages FROM scan_results
      WHERE status = 'scanned'
    `)

    totalPackages = queryTotal.get().totalPackages
    console.log(`Found ${totalPackages} scanned packages in total.`)

    if (allDetections.length === 0) {
      console.log('No detections found, creating empty index file.')
      await fs.promises.writeFile(path.join(chunkOutputDir, 'index.json'), '[]', 'utf-8')
      await fs.promises.writeFile(path.join(chunkOutputDir, 'signatures.json'), JSON.stringify(Signatures, null, 2), 'utf-8')
      await fs.promises.writeFile(path.join(chunkOutputDir, 'count.json'), JSON.stringify({ count: 0, total: totalPackages, npmPackageCount: allPackageNames.length }, null, 2), 'utf-8')
      if (db && db.isOpen) db.close()
      process.exit(0)
    }

  } catch (queryError) {
    console.error('Error querying database for detections:', queryError)
    if (db && db.isOpen) db.close()
    process.exit(1)
  }

  const packagesByFirstLetter = {}
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'

  for (const letter of alphabet) packagesByFirstLetter[letter] = []
  for (const digit of digits) packagesByFirstLetter[digit] = []
  packagesByFirstLetter.other = []

  for (const pkg of allDetections) {
    const firstChar = pkg.name?.toLowerCase()[0]
    if (firstChar && alphabet.includes(firstChar)) packagesByFirstLetter[firstChar].push(pkg)
    else if (firstChar && digits.includes(firstChar)) packagesByFirstLetter[firstChar].push(pkg)
    else packagesByFirstLetter.other.push(pkg)
  }

  console.log('--- Package Distribution by First Letter ---')
  let totalInBuckets = 0
  for (const key of [...alphabet, ...digits, 'other']) {
    const count = packagesByFirstLetter[key].length
    if (count > 0) {
      console.log(`Bucket '${key}': ${count} packages`)
      totalInBuckets += count
    }
  }

  console.log(`Total packages distributed: ${totalInBuckets}`)
  console.log('------------------------------------------')

  const generatedFiles = []
  try {
    for (const key in packagesByFirstLetter) {
      if (packagesByFirstLetter[key].length > 0) {
        const fileName = `${key}.json.gz`
        const filePath = path.join(chunkOutputDir, fileName)
        try {
          const dataToProcess = packagesByFirstLetter[key].map(pkg => ({
            name: pkg.name,
            detections_count: pkg.detections_count,
            scanned_at: pkg.scanned_at,
            status: pkg.status,
            files_scanned: pkg.files_scanned,
            findings: JSON.parse(pkg.findings_json)
              .filter(f => f.triggered)
              .map(f => ({ index: f.index, file: f.file.replace(/\/tmp\/codebase-scanner-[^\/]+\/package\//g, '') }))
          }))

          const jsonData = JSON.stringify(dataToProcess, null, 2)
          const gzippedData = await gzip(Buffer.from(jsonData))

          await fs.promises.writeFile(filePath, gzippedData)
          console.log(`Wrote ${packagesByFirstLetter[key].length} packages to ${fileName}`)
          generatedFiles.push(fileName)
        } catch (writeError) {
          console.error(`Error writing chunk file ${filePath}:`, writeError)
        }
      }
    }

    generatedFiles.sort((a, b) => { 
      const nameA = a.split('.')[0]
      const nameB = b.split('.')[0]

      if (nameA === 'other') return 1
      if (nameB === 'other') return -1

      const isADigit = digits.includes(nameA)
      const isBDigit = digits.includes(nameB)

      if (isADigit && isBDigit) return parseInt(nameA, 10) - parseInt(nameB, 10)
      if (isADigit) return -1
      if (isBDigit) return 1

      return nameA.localeCompare(nameB)
    })

    const indexFilePath = path.join(chunkOutputDir, 'index.json')
    await fs.promises.writeFile(indexFilePath, JSON.stringify(generatedFiles, null, 2), 'utf-8')
    await fs.promises.writeFile(path.join(chunkOutputDir, 'signatures.json'), JSON.stringify(Signatures, null, 2), 'utf-8')
    await fs.promises.writeFile(path.join(chunkOutputDir, 'count.json'), JSON.stringify({ count: allDetections.length, total: totalPackages, npmPackageCount: allPackageNames.length }, null, 2), 'utf-8')
    console.log(`Wrote index file to ${indexFilePath}`) 
    console.log('JSON chunk generation complete.')
  } catch (writeError) {
    console.error(`Error during file writing process:`, writeError)
    process.exit(1)
  } finally {
    if (db && db.isOpen) {
      try { db.close() } catch(e) { console.error('Error closing DB:', e) }
    }
  }
}

generateDetectionChunks().catch(error => {
  console.error('Unhandled error during chunk generation:', error)
  process.exit(1)
})
