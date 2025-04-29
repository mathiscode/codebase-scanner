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
  },

  {
    name: 'Escaped Unicode',
    signature: '\\u0',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'warning'
  },

  {
    name: 'Reassigned Eval',
    signature: '=eval',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'malicious'
  },

  {
    name: 'Reassigned Eval',
    signature: '= eval',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'malicious'
  },

  {
    name: 'Obfuscated Javascript (Hex Variable Array Access)',
    regex: true,
    signature: '_0x[a-f0-9]{4,}\\[',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'malicious'
  },

  {
    name: 'Obfuscated Javascript (String.fromCharCode)',
    signature: 'String.fromCharCode(',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'warning'
  },

  {
    name: 'Obfuscated Javascript (parseInt High Radix)',
    regex: true,
    signature: 'parseInt\\([^,]+,\\s*(?:[1-9]\\d+|[2-9])\\)',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'warning'
  },

  {
    name: 'Obfuscated Javascript (Encoded Constructor)',
    signature: 'modsbeulqtcnrcgprwofjtcixoakrhvuytnsz',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'],
    level: 'malicious'
  }
]
