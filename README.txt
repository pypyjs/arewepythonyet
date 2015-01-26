
This is the the code behind http://arewepythonyet.com, a site for
tracking performance and other goodness measures for pypy.js.

To build pypy.js and all the dependencies required to run the benchamrks,
do:

    make build

To perform a benchmark run and record results in a JSON file under
./website/data/bench do:

    make bench

To summarize all available benchmark runs into data for display on the
website, do:

    make summary

