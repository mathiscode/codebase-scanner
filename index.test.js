import { describe, it, expect } from '@jest/globals'
import { iterateFiles, deepFlatten } from './index.mjs'
import Signatures from './signatures/index.mjs'
import path from 'node:path'

const projectRoot = process.cwd()
const samplesDir = path.join(projectRoot, 'samples')

describe('Signature Integration Test', () => {
  it('should trigger all defined signatures when scanning the samples directory', async () => {
    const scanOptions = { json: true }

    expect(Array.isArray(Signatures)).toBe(true)
    const allSignatureNames = new Set(Signatures.map(sig => sig.name))
    expect(allSignatureNames.size).toBeGreaterThan(0)

    const rawResults = await iterateFiles(samplesDir, scanOptions)
    const flatResults = deepFlatten(rawResults).filter(r => r && typeof r === 'object')
    const triggeredSignatureNames = new Set(
      flatResults
        .filter(result => result.triggered)
        .map(result => result.name)
    )

    const missingSignatures = []
    for (const name of allSignatureNames) {
      if (!triggeredSignatureNames.has(name)) missingSignatures.push(name)
    }

    if (missingSignatures.length > 0) console.error('Missing Signatures:', missingSignatures)
    expect(missingSignatures).toEqual([])

  }, 60000)
})
