# Report the best result over 10 runs.
# This should give plenty of time for all layers of JIT to warm up.
from test import pystone
stones = max(pystone.pystones(50000)[1] for _ in xrange(10))
print stones
