
This directory contains benchmarks from the pypy benchmark suite, lightly
modified so that they're easy to run under pypyjs:

  https://bitbucket.org/pypy/benchmarks/

All files are copyright their original authors and are redistributed in
compliance with their original license; see the comments at the top of
each file for more details.

Each of the .py files in this directory, when executed as a python program,
will print a series of numbers to stdout.  Each number represents the time
to execute one iteration of that benchmark.  Consuming software may summarize
these as required, e.g. by taking geometric mean.

The file "runner.js" is a javascript template that is used by the benchmark
machinery to execute a file in pypy.js.

The following front-page benchmarks from pypy have not yet been ported over,
as they're more complicated to run (e.g. require installed packages or
external files):

  * django
  * html5lib
  * rietveld
  * slowspitfire
  * spambayes
  * spitfire
  * spitfire_cstringio
  * telco
  * twisted_iteration
  * twisted_names
  * twisted_pb
  * twisted_tcp

