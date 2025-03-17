export default [
  {
    name: 'Obfuscated Javascript (Base64 "platform")',
    signature: 'cGxhdGZvcm0',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'malicious'
  },

  {
    name: 'Obfuscated Javascript (Base64 "eval")',
    signature: 'ZXZhbAo=',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'malicious'
  },

  {
    name: 'Obfuscated Javascript (Base64 "team15")',
    signature: 'dGVhbTE1',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'malicious'
  },

  {
    name: 'Obfuscated Javascript (Buffered "child_process")',
    signature: 'FhwPVBErFkoaFwNLBg',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'malicious'
  },

  {
    name: 'Obfuscated Javascript (Buffered "Local State")',
    signature: 'ORsFWRlUNUwUAAM',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'malicious'
  },

  {
    name: 'Obfuscated Javascript (Hex Functions)',
    signature: 'function(_0x',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'malicious'
  },

  {
    name: 'Obfuscated Javascript (Function Constructor)',
    signature: 'new Function(',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'malicious'
  },

  {
    name: 'Eval',
    signature: 'eval(',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'warning'
  },

  {
    name: 'Evaluated Response (res)',
    signature: 'eval(res',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'malicious'
  },
  
  {
    name: 'Evaluated Response (err)',
    signature: 'eval(err',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'malicious'
  },

  {
    name: 'Malicious Endpoint (Fake Alchemy API)',
    signature: 'alchemy-api-v3.cloud',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'malicious'
  }
]
