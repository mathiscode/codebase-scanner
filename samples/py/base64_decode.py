import base64

encoded_string = b'SGVsbG8gV29ybGQh'
decoded_string = base64.b64decode(encoded_string)
print(decoded_string.decode('utf-8'))
print("Hello from base64 decode sample") 