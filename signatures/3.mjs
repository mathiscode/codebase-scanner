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
    name: 'Unicode Private Use Area Characters',
    regex: true,
    signature: '[\\uE000-\\uF8FF\\U000F0000-\\U000FFFFD\\U00100000-\\U0010FFFD]',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx', 'json', 'py'],
    level: 'warning'
  },

  {
    name: 'Excessive Whitespace',
    regex: true,
    signature: '\\s{80,}',
    extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx', 'py'],
    level: 'warning'
  },
]
