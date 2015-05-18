load("{{pypyjs_lib}}")
var vm = new PyPyJS();
vm.ready.then(function() {
  return vm.loadModuleData.apply(vm, {{py_imports}})
}).then(function() {
  return vm.exec({{py_code}})
}).catch(function(err) {
  printErr(err);
  throw err;
});
