from test import pystone
pystone.pystones(1)
for _ in xrange(10):
    _, stones = pystone.pystones(50000)
    # Sometimes d8 produces zero or negative pystones/second, due to the
    # JS JIT warmup interfering with the way pystone tries to adjust for
    # null loop time.  We just replace it with small positive value.
    print max(stones, 1)
