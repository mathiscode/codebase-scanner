// Sample for signature: new Function(
const dynamicFunction = new Function('a', 'b', 'return a + b')
console.log(dynamicFunction(1, 2)) 