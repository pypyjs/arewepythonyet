
function sum_log(iterations) {
  var total = 0
  for (var i = 1; i <= iterations; i++) {
    total += Math.log(i)
  }
  return total
}

for (var i = 0; i < 3; i++) {
  t1 = +Date.now()
  sum_log(1000000)
  t2 = +Date.now()
  print((t2 - t1) / 1000)
}
