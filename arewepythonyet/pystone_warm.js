var tStart, tFinish;
load("./build/lib/pypy/lib/pypy.js")
var vm = new PyPyJS();
vm.ready.then(function() {
  return vm.eval("from test import pystone");
}).then(function() {
  return vm.eval("stones = max(pystone.pystones(50000)[1] for _ in xrange(10))");
}).then(function() {
  return vm.get("stones");
}).then(function(stones) {
  print(stones)
}).catch(function(err) {
  throw err;
});
