import marshal

code_obj = compile("print('Marshalled code')", 'sample', 'exec')
marshalled_data = marshal.dumps(code_obj)

loaded_code_obj = marshal.loads(marshalled_data)
exec(loaded_code_obj)
print("Hello from marshal loads sample") 