// Sample for signature: eval(err
function handleError(err) {
  // Potentially dangerous if err is from an external source
  try {
    const errorInfo = eval(err)
    console.log('Error details:', errorInfo)
  } catch (e) {
    console.error('Eval error:', e)
  }
}
handleError('({ code: 500, message: "server error" })') 