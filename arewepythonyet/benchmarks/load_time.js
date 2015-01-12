var tStart = +new Date();
load("{{pypyjs_lib}}")
var vm = new PyPyJS();
vm.ready.then(function() {
  var tFinish = +new Date();
  print(tFinish - tStart);
}, function(err) {
  throw err;
});
