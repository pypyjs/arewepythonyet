from test import pystone
# Do a single round to warmup.
# Without this, d8 produces zero pystones per second due to warmup
# interfering with the way pystone tries to adjust for null loop time.
pystone.pystones(1)
_, stones = pystone.pystones(50000)
print stones
