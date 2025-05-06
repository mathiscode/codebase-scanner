import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { DatabaseSync } from 'node:sqlite'

let logDir = path.resolve(process.cwd(), 'codebase-scanner-npm-registry-results')
if (!fs.existsSync(logDir)) logDir = path.resolve(os.tmpdir(), 'codebase-scanner-npm-registry-results')

const dbPath = path.join(logDir, 'codebase-scanner-npm-registry.sqlite')
const outputDir = path.resolve(path.dirname(import.meta.url.substring(7)), '../pages') // Assumes this script is in utils/
const outputPath = path.join(outputDir, 'detections.npm.json')

async function generateDetectionsJson() {
  console.log(`Reading scan results from database: ${dbPath}`)
  console.log(`Outputting filtered results to: ${outputPath}`)

  let db
  try {
    if (!fs.existsSync(dbPath)) {
      console.error(`FATAL: Database file not found at ${dbPath}. Run the scan first.`)
      process.exit(1)
    }

    db = new DatabaseSync(dbPath, { readonly: true })
  } catch (dbError) {
    console.error(`FATAL: Could not open SQLite database at ${dbPath}:`, dbError)
    process.exit(1)
  }

  let results = []
  try {
    const query = db.prepare(`
      SELECT name, detections_count, scanned_at, status, files_scanned, findings_json
      FROM scan_results
      WHERE detections_count > 0
      ORDER BY detections_count DESC, name ASC;
    `)

    results = query.all()
    console.log(`Found ${results.length} packages with detections > 0.`)
  } catch (queryError) {
    console.error('Error querying database for detections:', queryError)
    db.close()
    process.exit(1)
  } finally {
    if (db && db.isOpen) db.close()
  }

  try {
    await fs.promises.mkdir(outputDir, { recursive: true })
    await fs.promises.writeFile(outputPath, JSON.stringify(results, null, 2), 'utf-8')
    console.log(`Successfully wrote ${results.length} records to ${outputPath}`)
  } catch (writeError) {
    console.error(`Error writing JSON file to ${outputPath}:`, writeError)
    process.exit(1)
  }
}

generateDetectionsJson().catch(error => {
  console.error('Unhandled error during generation:', error)
  process.exit(1)
})
