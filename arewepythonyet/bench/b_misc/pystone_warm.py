from test import pystone
for _ in xrange(10):
    _, stones = pystone.pystones(50000)
    print stones
