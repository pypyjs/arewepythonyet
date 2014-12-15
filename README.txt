
This will be the code and infra for http://arewepythonyet.com, a site
for tracking performance and other goodness measures for pypy.js.

Here's basically what we need to do:

  * identify the machine we're working on, e.g. cpu info
  * checkout and build latest d8, spidermonkey, cpython, pypy, pypyjs
  * run and record various benchmarks:
    * code size, compressed code size
    * load time
    * pystone, the other benchmarks from pypy suite
       * combine these into single overall score, like pypy does
    * port some js benchmarks to python and compare against raw js?
  * dump it all into a timestamped json file, and commit to this repo
  * generate static website for displaying the good news

