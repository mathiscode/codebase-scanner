import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { DatabaseSync } from 'node:sqlite'

// --- Configuration ---
let logDir = path.resolve(process.cwd(), 'codebase-scanner-npm-registry-results')
if (!fs.existsSync(logDir)) logDir = path.resolve(os.tmpdir(), 'codebase-scanner-npm-registry-results')

const dbPath = path.join(logDir, 'codebase-scanner-npm-registry.sqlite')
// Output directory for the JSON chunk files relative to project root
const chunkOutputDir = path.resolve(process.cwd(), 'pages/data/npm')
// --- End Configuration ---

async function generateDetectionChunks() {
  console.log(`Reading scan results from database: ${dbPath}`)
  console.log(`Outputting filtered JSON chunks to: ${chunkOutputDir}`)

  let db
  try {
    if (!fs.existsSync(dbPath)) {
      console.error(`FATAL: Database file not found at ${dbPath}. Run the scan first.`)
      process.exit(1)
    }
    
    fs.mkdirSync(chunkOutputDir, { recursive: true }) // Ensure chunk output directory exists
    db = new DatabaseSync(dbPath, { readonly: true })
  } catch (dbError) {
    console.error(`FATAL: Could not open SQLite database at ${dbPath} or create output directory:`, dbError)
    process.exit(1)
  }

  let allDetections = []
  try {
    // Query packages with detections, ordered by name for consistent chunking
    const query = db.prepare(`
      SELECT name, detections_count, scanned_at, status, files_scanned, findings_json
      FROM scan_results
      WHERE detections_count > 0 AND status = 'scanned'
      ORDER BY name ASC;
    `)

    allDetections = query.all()
    console.log(`Found ${allDetections.length} packages with detections > 0.`)

    if (allDetections.length === 0) {
      console.log('No detections found, creating empty index file.')
      // Create an empty index file if no detections
      await fs.promises.writeFile(path.join(chunkOutputDir, 'index.json'), '[]', 'utf-8')
      if (db && db.isOpen) db.close()
      process.exit(0)
    }

  } catch (queryError) {
    console.error('Error querying database for detections:', queryError)
    if (db && db.isOpen) db.close()
    process.exit(1)
  }

  // Group packages by first letter/digit
  const packagesByFirstLetter = {}
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'

  // Initialize buckets for letters, digits, and other
  for (const letter of alphabet) {
    packagesByFirstLetter[letter] = []
  }
  for (const digit of digits) {
    packagesByFirstLetter[digit] = []
  }
  packagesByFirstLetter.other = [] // For packages not starting with a-z or 0-9

  for (const pkg of allDetections) {
    const firstChar = pkg.name?.toLowerCase()[0]
    if (firstChar && alphabet.includes(firstChar)) {
      packagesByFirstLetter[firstChar].push(pkg)
    } else if (firstChar && digits.includes(firstChar)) {
      packagesByFirstLetter[firstChar].push(pkg)
    } else {
      packagesByFirstLetter.other.push(pkg)
    }
  }

  // Add logging for bucket distribution
  console.log('--- Package Distribution by First Letter ---')
  let totalInBuckets = 0
  for (const key of [...alphabet, ...digits, 'other']) {
    const count = packagesByFirstLetter[key].length
    if (count > 0) {
        console.log(`Bucket '${key}': ${count} packages`)
        totalInBuckets += count
    }
  }
  console.log(`Total packages distributed: ${totalInBuckets}`) // Should match allDetections.length
  console.log('------------------------------------------')

  // Write chunks and build index
  const generatedFiles = []
  try {
    for (const key in packagesByFirstLetter) {
      if (packagesByFirstLetter[key].length > 0) {
        const fileName = `${key}.json`
        const filePath = path.join(chunkOutputDir, fileName)
        try {
          await fs.promises.writeFile(filePath, JSON.stringify(packagesByFirstLetter[key], null, 2), 'utf-8')
          console.log(`Wrote ${packagesByFirstLetter[key].length} packages to ${fileName}`)
          generatedFiles.push(fileName)
        } catch (writeError) {
          console.error(`Error writing chunk file ${filePath}:`, writeError)
          // Decide if we should continue or exit
        }
      }
    }

    // Sort and write index file
    generatedFiles.sort((a, b) => { 
        const nameA = a.split('.')[0]
        const nameB = b.split('.')[0]

        // 'other' always last
        if (nameA === 'other') return 1
        if (nameB === 'other') return -1

        // Check if both are digits
        const isADigit = digits.includes(nameA)
        const isBDigit = digits.includes(nameB)

        if (isADigit && isBDigit) {
            return parseInt(nameA, 10) - parseInt(nameB, 10) // Numeric sort for digits
        } else if (isADigit) {
            return -1 // Digits before letters
        } else if (isBDigit) {
            return 1 // Letters after digits
        } else {
            return nameA.localeCompare(nameB) // Alphabetical sort for letters
        }
    })
    const indexFilePath = path.join(chunkOutputDir, 'index.json')
    await fs.promises.writeFile(indexFilePath, JSON.stringify(generatedFiles, null, 2), 'utf-8')
    console.log(`Wrote index file to ${indexFilePath}`) 
    console.log('JSON chunk generation complete.')

  } catch (writeError) {
    console.error(`Error during file writing process:`, writeError)
    // Error already logged for specific file, maybe add general error here
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
