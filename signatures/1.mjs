/**
 * @typedef {Object} Signature
 * @property {string} name
 * @property {boolean} regex
 * @property {string} signature
 * @property {string[]} extensions
 * @property {string} level
*/

export default [
  {
    name: 'Obfuscated Python (PyArmor Runtime Import)',
    signature: 'from pytransform import pyarmor_runtime',
    extensions: ['py'],
    level: 'malicious'
  },
  {
    name: 'Obfuscated Python (PyArmor Runtime Call)',
    signature: 'pyarmor_runtime()',
    extensions: ['py'],
    level: 'malicious'
  },
  {
    name: 'Obfuscated Python (PyArmor Hook)',
    signature: '__pyarmor__(',
    extensions: ['py'],
    level: 'malicious'
  },
  {
    name: 'Python Eval Call',
    signature: 'eval(',
    extensions: ['py'],
    level: 'malicious'
  },
  {
    name: 'Python Exec Call',
    signature: 'exec(',
    extensions: ['py'],
    level: 'malicious'
  },
  {
    name: 'Python Base64 Decode',
    signature: 'base64.b64decode(',
    extensions: ['py'],
    level: 'warning'
  },
  {
    name: 'Python Marshal Load',
    signature: 'marshal.loads(',
    extensions: ['py'],
    level: 'malicious'
  },
  {
    name: 'Pyminifier Artifact',
    signature: '# Created by pyminifier',
    extensions: ['py'],
    level: 'warning'
  }
]
