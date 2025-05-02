// Sample for signature: eval(res
function handleResponse(res) {
  // Potentially dangerous if res is user-controlled
  try {
    const data = eval(res)
    console.log(data)
  } catch (e) {
    console.error('Eval error:', e)
  }
}
handleResponse('({ status: "ok" })') 