
import os
import sys
import json
import psutil
import hashlib
import uuid
import subprocess
from datetime import datetime


def main(argv):
    # XXX TODO: use argparse
    if len(argv) <= 1:
        root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    elif len(argv) == 2:
        root_dir = os.path.abspath(argv[1])
    else:
        raise ValueError("at most one argv required")
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    machine_details = get_machine_details()
    res_filename = "bench-{timestamp}-{platform}-{fingerprint}.json".format(
        timestamp=timestamp,
        platform=machine_details["platform"],
        fingerprint=machine_details["fingerprint"],
    )
    res_dir = os.path.join(root_dir, "results")
    res_file = open(os.path.join(res_dir, res_filename), "w")
    try:
        benv = BenchEnvironment(root_dir)
        results = {}
        results["timestamp"] = timestamp
        results["machine_details"] = machine_details
        results["build_details"] = benv.get_build_details()
        results["benchmarks"] = benv.run_benchmarks()
        json.dump(results, res_file,
            ensure_ascii=True,
            allow_nan=False,
            indent=4,
        )
    except Exception:
        os.unlink(os.path.join(res_dir, res_filename))
        raise
    finally:
        res_file.close()


def get_machine_details():
    mac_address = uuid.getnode()
    if bin(mac_address)[9] == 1:
        raise RuntimeError("unable to get reliable MAC address")
    mac_address = "{:12X}".format(mac_address)
    details = {
        "platform": sys.platform,
        "mac_address": mac_address,
        "cpu_count": psutil.cpu_count(),
        "virtual_memory": psutil.virtual_memory().total,
    }
    fingerprint = json.dumps(details, sort_keys=True)
    fingerprint = hashlib.sha256(fingerprint).hexdigest()[:16]
    details["fingerprint"] = fingerprint
    return details


class BenchEnvironment(object):

    def __init__(self, root_dir):
        self.root_dir = root_dir

    def abspath(self, *relpaths):
        return os.path.abspath(os.path.join(self.root_dir, *relpaths))

    def cat(self, path):
        with open(self.abspath(path), "r") as f:
            return f.read()

    def do(self, cmd, **kwds):
        if isinstance(cmd, basestring):
            cmd = [cmd]
        if cmd[0][0] not in ("/", "."):
            my_cmd = self.abspath("build", "bin", cmd[0])
            if os.path.exists(my_cmd):
                cmd[0] = my_cmd
        p = subprocess.Popen(cmd, **kwds)
        p.wait()
        if p.returncode != 0:
            raise subprocess.CalledProcessError(p.returncode, cmd)

    def bt(self, cmd, **kwds):
        if isinstance(cmd, basestring):
            cmd = [cmd]
        if cmd[0][0] not in ("/", "."):
            my_cmd = self.abspath("build", "bin", cmd[0])
            if os.path.exists(my_cmd):
                cmd[0] = my_cmd
        kwds.setdefault("stdout", subprocess.PIPE)
        p = subprocess.Popen(cmd, **kwds)
        stdout, _ = p.communicate()
        if p.returncode != 0:
            raise subprocess.CalledProcessError(p.returncode, cmd)
        return stdout

    def get_build_details(self):
        details = {}
        pypyjs_rev = self.cat("build/pypyjs/.git/refs/heads/master")
        details["pypyjs_revision"] = pypyjs_rev.strip()
        cpython_rev = self.cat("build/cpython/.git/refs/heads/2.7")
        details["cpython_revision"] = cpython_rev.strip()
        gecko_rev = self.cat("build/gecko-dev/.git/refs/heads/master")
        details["gecko_revision"] = gecko_rev.strip()
        v8_rev = self.cat("build/v8/.git/refs/heads/master")
        details["v8_revision"] = v8_rev.strip()
        build_image = self.bt(["docker", "images", "rfkelly/pypyjs-build"])
        build_image = build_image.strip().split("\n")[-1]
        build_image = build_image.strip().split()[2]
        details["pypyjs_build_image"] = build_image
        return details

    def run_benchmarks(self):
        # Each named benchmark is a dict mapping pypyjs build names
        # to a dict of results.  The dict of results can depend on the
        # benchmark, but it's usually another dict mapping js engine
        # names to a list of numeric results.
        results = {}
        results["file_size"] = self._run_benchmark_file_size()
        results["load_time"] = self._run_benchmark_load_time()
        results["pystone_cold"] = self._run_benchmark_pystone_cold()
        results["pystone_warm"] = self._run_benchmark_pystone_warm()
        return results

    def _run_benchmark_file_size(self):
        """Benchmark tracking the file download size of the interpreter.

        This benchmark tracks the combined size of all files that must be
        downloaded to launch the basic interpreter prompt.  It reports both
        raw and gzipped size.
        """

        def get_size(build, name, ignore=False):
            path = self.abspath("build", "lib", build, "lib", name)
            if ignore and not os.path.exists(path):
                return 0
            return os.stat(path).st_size

        def get_compressed_size(build, name, ignore=False):
            path = self.abspath("build", "lib", build, "lib", name)
            if ignore and not os.path.exists(path):
                return 0
            self.do(["gzip", "-9", "--keep", "--force", path])
            return os.stat(path + ".gz").st_size

        results = {}
        for build in ("pypy", "pypy-nojit"):
            results[build] = {
                "raw": 0,
                "gz": 0,
            }
            for name in ("pypy.js", "pypy.vm.js",):
                results[build]["raw"] += get_size(build, name)
                results[build]["gz"] += get_compressed_size(build, name)
            for name in ("pypy.vm.js.mem",):
                results[build]["raw"] += get_size(build, name, True)
                results[build]["gz"] += get_compressed_size(build, name, True)
        return results

    def _run_benchmark_load_time(self):
        """Benchmark tracking time to load a usable interpreter.

        This benchmark tracks the time taken to load, parse, and process
        the pypy.js interpreter code into a state where it can start
        executing - essentially, the time between instantiating a new
        interpreter and its 'ready' promise being fulfilled.

        Results are reported as load time in milliseconds for each js engine.
        """
        return self._run_js_benchmark("load_time.js")

    def _run_benchmark_pystone_cold(self):
        """Benchmark tracking pystones-per-second with cold JIT.

        This benchmark tracks the number of pystones-per-second achieved
        without allowing JIT warmup.  Larger numbers are better.

        Results are reported as pystones/second count for each js engine.
        """
        return self._run_js_benchmark("pystone_cold.js")

    def _run_benchmark_pystone_warm(self):
        """Benchmark tracking pystones-per-second with warm JIT.

        This benchmark tracks the number of pystones-per-second achieved
        when allowing JIT warmup.  Larger numbers are better.

        Results are reported as pystones/second count for each js engine.
        """
        return self._run_js_benchmark("pystone_warm.js")

    def _run_js_benchmark(self, name):
        """Helper to run a js file benchmark across all engines.

        Called with the name of a javascript benchmark file, this method
        runs it in each available js engine and reports back the results.
        The file is expected to print a single number on stdout as the
        result of the benchmark.
        """
        return {
            "js": self._run_js_engine_benchmark("js", name),
            "d8": self._run_js_engine_benchmark("d8", name),
        }

    def _run_js_engine_benchmark(self, engine, name):
        """Helper to run a js file benchmark in a single engine."""
        results = []
        js_file = os.path.join(os.path.dirname(__file__), name)
        for _ in xrange(10):
            cmd = [engine, js_file]
            output = self.bt(cmd).strip()
            if not output:
                raise RuntimeError("No output from {}".format(cmd))
            results.append(float(output))
        return results
