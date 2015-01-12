load("{{pypyjs_lib}}")
var vm = new PyPyJS();
vm.ready.then(function() {
  // XXX TODO: currently have to put in one line at a time
  // as separate vm.eval() statements, because the loader can't
  // reliably parse input statements out of multi-line python code.
  {{py_code}}
}).catch(function(err) {
  throw err;
});
