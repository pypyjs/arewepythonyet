var tStart = +new Date();
load("{{pypyjs_lib}}")
pypyjs.ready().then(function() {
  var tFinish = +new Date();
  print((tFinish - tStart) / 1000);
}, function(err) {
  throw err;
});
