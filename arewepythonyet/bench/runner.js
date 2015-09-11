load("{{pypyjs_lib}}")
pypyjs.ready().then(function() {
  return pypyjs.loadModuleData.apply(pypyjs, {{py_imports}})
}).then(function() {
  return pypyjs.exec({{py_code}})
}).catch(function(err) {
  printErr(err);
  throw err;
});
