import { describe, it, expect } from '@jest/globals'
import { iterateFiles, deepFlatten } from './index.mjs'
import Signatures from './signatures/index.mjs'
import path from 'node:path'

const projectRoot = process.cwd()
const samplesDir = path.join(projectRoot, 'samples')

describe('Signature Integration Test', () => {
  it('should trigger all defined signatures when scanning the samples directory', async () => {
    const scanOptions = { json: true }

    // Ensure Signatures is an array
    expect(Array.isArray(Signatures)).toBe(true)

    // Get unique names of all defined signatures
    const allSignatureNames = new Set(Signatures.map(sig => sig.name))
    expect(allSignatureNames.size).toBeGreaterThan(0) // Make sure signatures loaded

    // Run the scan
    console.log(`Scanning directory: ${samplesDir}`)
    const rawResults = await iterateFiles(samplesDir, scanOptions)

    // Flatten results and filter out potential undefined/null values
    const flatResults = deepFlatten(rawResults).filter(r => r && typeof r === 'object')

    // Get unique names of triggered signatures from the results
    const triggeredSignatureNames = new Set(
      flatResults
        .filter(result => result.triggered)
        .map(result => result.name)
    )

    // Find which signatures defined in Signatures were NOT triggered
    const missingSignatures = []
    for (const name of allSignatureNames) {
      if (!triggeredSignatureNames.has(name)) {
        missingSignatures.push(name)
      }
    }

    // Assert that the list of missing signatures is empty
    if (missingSignatures.length > 0) {
      console.error('Missing Signatures:', missingSignatures)
    }
    expect(missingSignatures).toEqual([])

  }, 60000) // Set a longer timeout (e.g., 60 seconds) for file I/O
})
