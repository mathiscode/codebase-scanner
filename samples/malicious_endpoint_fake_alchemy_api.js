// Sample for signature: alchemy-api-v3.cloud
const apiUrl = 'https://alchemy-api-v3.cloud/some/path'
fetch(apiUrl)
  .then(res => console.log('Fetched from potentially malicious URL'))
  .catch(err => console.error('Fetch error:', err)) 