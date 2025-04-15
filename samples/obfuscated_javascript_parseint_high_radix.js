// Example for parseInt with high radix obfuscation
const encodedCommand = '65786563'; // 'exec' in hex
const decodedCommand = parseInt(encodedCommand, 16).toString();

const encodedValue = 'z1'; // 35*36 + 1 = 1261
const decodedValue = parseInt(encodedValue, 36); // Using base 36 