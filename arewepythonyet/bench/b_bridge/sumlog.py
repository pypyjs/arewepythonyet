
import js
import time

Math = js.globals["Math"]

def sum_log(iterations):
    total = 0
    i = 1
    while i <= iterations:
        total += float(Math.log(i))
        i += 1
    return total


for i in xrange(3):
    t1 = time.time()
    sum_log(1000000)
    t2 = time.time()
    print t2 - t1

