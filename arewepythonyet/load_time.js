var tStart = +new Date();
load("./build/lib/pypy/lib/pypy.js")
var vm = new PyPyJS();
vm.ready.then(function() {
  var tFinish = +new Date();
  print(tFinish - tStart);
}, function(err) {
  throw err;
});
