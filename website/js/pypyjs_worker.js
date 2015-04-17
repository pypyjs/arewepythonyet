var t_start = +Date.now();
postMessage({ t_start: t_start });
importScripts("http://pypyjs.org/js/pypy.js-0.2.0/lib/pypy.js");
var vm = new PyPyJS();
vm.ready.then(function() {
  var t_end = +Date.now();
  postMessage({ t_end: t_end });
}, function(err) {
  postMessage({ error: err });
});
