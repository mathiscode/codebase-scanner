import fs from 'node:fs'
import path from 'node:path'

const currentDir = path.dirname(new URL(import.meta.url).pathname)
const files = fs.readdirSync(currentDir)

const signaturePromises = files
  .filter(file => file !== 'index.mjs' && /\.mjs$/.test(file))
  .map(async (file) => {
    try {
      const filePath = path.join(currentDir, file)
      const module = await import(filePath)
      return Array.isArray(module.default) ? module.default : []
    } catch (error) {
      console.error(`Error loading signature file ${file}:`, error)
      return []
    }
  })

const signaturesArrays = await Promise.all(signaturePromises)
const signatures = signaturesArrays.flat()
export default signatures
