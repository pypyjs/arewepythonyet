var t_start = +Date.now();
postMessage({ t_start: t_start });
importScripts("http://pypyjs.org/demo/lib/pypy.js");
var vm = new PyPyJS();
vm.ready.then(function() {
  var t_end = +Date.now();
  postMessage({ t_end: t_end });
}, function(err) {
  postMessage({ error: err });
});
