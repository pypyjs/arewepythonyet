"""

Infrastructure for producing a single benchmark run.

This module exports the function bench() which can be called to perform
a full benchmark run of all python engines available in the build environment.
It'll eventually grow support for running with subsets of engines/benchmarks.

The return value is dict of benchmark results along with system metadata.
The results are a set of nested dicts grouping the results by category name,
then by individual benchmark, then by python engine in use.  For each engine
we record a list of output from multiple runs, each of which may produce
a sequence of individual timing results.

"""

import os
import sys
import json
import math
import uuid
import psutil
import hashlib
import tempfile
import operator
import contextlib
import subprocess
from datetime import datetime


def bench(root_dir=None):
    if root_dir is not None:
        root_dir = os.path.abspath(root_dir)
    else:
        dirname= os.path.dirname
        root_dir = dirname(dirname(dirname(os.path.abspath(__file__))))
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    machine_details = get_machine_details()
    benv = BenchEnvironment(root_dir)
    results = {}
    results["timestamp"] = timestamp
    results["machine_details"] = machine_details
    results["build_details"] = benv.get_build_details()
    results["benchmarks"] = benv.run_benchmarks()
    return results


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


def geometric_mean(results):
    return math.pow(reduce(operator.mul, results, 1), 1.0 / len(results))


class BenchEnvironment(object):

    def __init__(self, root_dir, num_runs=3):
        self.root_dir = root_dir
        self.num_runs = num_runs
        self.engines = []
        self.engines.append(NativeEngine(self, "cpython", "python"))
        self.engines.append(NativeEngine(self, "pypy"))
        self.engines.append(NativeEngine(self, "pypy-nojit"))
        for pypyjs_build in sorted(os.listdir(self.abspath("build", "lib"))):
            lib = self.abspath("build", "lib", pypyjs_build, "lib", "pypy.js")
            if os.path.exists(lib):
                for js_shell in ("js", "d8"):
                    self.engines.append(JSEngine(self, js_shell, pypyjs_build))

    def abspath(self, *relpaths):
        return os.path.abspath(os.path.join(self.root_dir, *relpaths))

    def benchpath(self, *relpaths):
        bench_root = os.path.dirname(__file__)
        return os.path.abspath(os.path.join(bench_root, *relpaths))

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
        # The git revision for pypyjs (and hence for pypy).
        pypyjs_rev = self.cat("build/pypyjs/.git/refs/heads/master")
        details["pypyjs_revision"] = pypyjs_rev.strip()
        # The git revision for cpython.
        cpython_rev = self.cat("build/cpython/.git/refs/heads/2.7")
        details["cpython_revision"] = cpython_rev.strip()
        # The git revision for gecko (and hence for spidermonkey).
        gecko_rev = self.cat("build/gecko-dev/.git/refs/heads/master")
        details["gecko_revision"] = gecko_rev.strip()
        # The git revision for v8.
        v8_rev = self.cat("build/v8/.git/refs/heads/master")
        details["v8_revision"] = v8_rev.strip()
        # The docker image used to build pypyjs.
        build_image = self.bt(["docker", "images", "rfkelly/pypyjs-build"])
        build_image = build_image.strip().split("\n")[-1]
        build_image = build_image.strip().split()[2]
        details["pypyjs_build_image"] = build_image
        # The version reported by emcc.
        cmd = ["docker", "run", "rfkelly/pypyjs-build", "emcc", "--version"]
        emcc_version = self.bt(cmd).strip().split("\n")[0]
        details["emcc_version"] = emcc_version
        # The version reported by native clang.
        clang_version = self.bt(["clang", "--version"]).strip().split("\n")[0]
        details["clang_version"] = clang_version
        # The list of available engines.
        details["engines"] = list(e.name for e in self.engines)
        return details

    def run_benchmarks(self):
        results = {}
        results["misc"] = self._run_misc_benchmarks()
        results["py"] = self._run_py_benchmarks()
        results["js"] = self._run_js_benchmarks()
        return results

    def _run_misc_benchmarks(self):
        results = {}
        results["file_size_raw"] = self._run_benchmark_file_size_raw()
        results["file_size_gz"] = self._run_benchmark_file_size_gz()
        b_misc_dir = self.benchpath("b_misc")
        for filename in sorted(os.listdir(b_misc_dir)):
            name, typ = filename.rsplit(".", 1)
            if typ == "js":
                results[name] = self._run_js_benchmark("b_misc/" + filename)
            elif typ == "py":
                results[name] = self._run_py_benchmark("b_misc/" + filename)
        return results

    def _run_py_benchmarks(self):
        results = {}
        b_py_dir = self.benchpath("b_py")
        for filename in sorted(os.listdir(b_py_dir)):
            name, typ = filename.rsplit(".", 1)
            if typ == "py":
                results[name] = self._run_py_benchmark("b_py/" + filename)
        return results

    def _run_js_benchmarks(self):
        results = {}
        # XXX TODO: some useful javascript/python comparison benchmarks?
        return results

    def _run_benchmark_file_size_raw(self):
        """Benchmark tracking the file download size of the interpreter.

        This benchmark tracks the combined size of all files that must be
        downloaded to launch the basic interpreter prompt.
        """

        def get_size(engine, filename, ignore=False):
            path = self.abspath(engine.pypyjs_build, "lib", filename)
            if ignore and not os.path.exists(path):
                return 0
            return os.stat(path).st_size

        results = {}
        for engine in self.engines:
            if not isinstance(engine, JSEngine):
                continue
            name = engine.name.split("+")[1]
            if name not in results:
                print "Measuring file size for {}".format(name)
                results[name] = 0
                for filename in ("pypy.js", "pypy.vm.js",):
                    results[name] += get_size(engine, filename)
                for filename in ("pypy.vm.js.mem",):
                    results[name] += get_size(engine, filename, ignore=True)

        return results

    def _run_benchmark_file_size_gz(self):
        """Benchmark tracking the file download size of the interpreter.

        This benchmark tracks the combined gzipped size of all files that must
        be downloaded to launch the basic interpreter prompt.
        """

        def get_size(build, name, ignore=False):
            path = self.abspath(engine.pypyjs_build, "lib", filename)
            if ignore and not os.path.exists(path):
                return 0
            self.do(["gzip", "-9", "--keep", "--force", path])
            return os.stat(path + ".gz").st_size

        results = {}
        for engine in self.engines:
            if not isinstance(engine, JSEngine):
                continue
            name = engine.name.split("+")[1]
            if name not in results:
                print "Measuring compressed file size for {}".format(name)
                results[name] = 0
                for filename in ("pypy.js", "pypy.vm.js",):
                    results[name] += get_size(engine, filename)
                for filename in ("pypy.vm.js.mem",):
                    results[name] += get_size(engine, filename, ignore=True)

        return results

    def _run_js_benchmark(self, name):
        """Helper to run a js file benchmark across all engines.

        Called with the name of a javascript benchmark file, this method
        runs it in each available js engine and reports back the results.
        The file is expected to print a single number on stdout as the
        result of the benchmark.
        """
        results = {}
        js_file = self.benchpath(name)
        b_name = name.rsplit("/", 1)[-1]
        for engine in self.engines:
            if not isinstance(engine, JSEngine):
                continue
            print "Measuring {} on {}".format(b_name, engine.name)
            results[engine.name] = list(
                engine.run_js_benchmark(js_file) for _ in xrange(self.num_runs)
            )
        return results

    def _run_py_benchmark(self, name):
        """Helper to run a py file benchmark across all engines.

        Called with the name of a python benchmark file, this method runs
        it in each available engine and reports back the results.  The
        file is expected to print a single number on stdout as the result
        of the benchmark.
        """
        results = {}
        py_file = self.benchpath(name)
        b_name = name.rsplit("/", 1)[-1]
        for engine in self.engines:
            print "Measuring {} on {}".format(b_name, engine.name)
            results[engine.name] = list(
                engine.run_py_benchmark(py_file) for _ in xrange(self.num_runs)
            )
        return results



class Engine(object):

    def __init__(self, benv, name):
        self.benv = benv
        self.name = name

    def run_py_benchmark(self, filename):
        raise NotImplementedError

    def run_js_benchmark(self, filename):
        raise NotImplementedError


class NativeEngine(Engine):

    def __init__(self, benv, name, py_shell=None):
        super(NativeEngine, self).__init__(benv, name)
        if py_shell is None:
            py_shell = self.name
        if py_shell[0] not in (".", "/"):
            py_shell = self.benv.abspath("build", "bin", py_shell)
        if not os.path.exists(py_shell):
            raise RuntimeError("File not found: {}".format(py_shell))
        self.py_shell = py_shell

    def run_py_benchmark(self, filename):
        cmd = [self.py_shell, filename]
        output = self.benv.bt(cmd).strip()
        if not output:
            raise RuntimeError("No output from {}".format(cmd))
        return [float(res.strip()) for res in output.split()]


class JSEngine(Engine):

    def __init__(self, benv, js_shell, pypyjs_build):
        name = "{}+{}".format(js_shell, pypyjs_build)
        super(JSEngine, self).__init__(benv, name)
        if js_shell[0] not in (".", "/"):
            js_shell = self.benv.abspath("build", "bin", js_shell)
        if not os.path.exists(js_shell):
            raise RuntimeError("File not found: {}".format(js_shell))
        self.js_shell = js_shell
        if pypyjs_build[0] not in (".", "/"):
            pypyjs_build = self.benv.abspath("build", "lib", pypyjs_build)
        if not os.path.exists(pypyjs_build):
            raise RuntimeError("Dir not found: {}".format(pypyjs_build))
        self.pypyjs_build = pypyjs_build
        self.pypyjs_lib = os.path.join(pypyjs_build, "lib", "pypy.js")

    def run_js_benchmark(self, filename):
        with self._templated_file(filename) as t_filename:
            cmd = [self.js_shell, t_filename]
            output = self.benv.bt(cmd).strip()
        if not output:
            raise RuntimeError("No output from {}".format(cmd))
        return [float(res.strip()) for res in output.split()]

    def run_py_benchmark(self, filename):
        # XXX TODO: the pypy.js automagic-module-file-loader currently
        # can't handle import statements in multi-line source code.
        # For now we parse out our imports and load them explicitly,
        # but we should eventually fix the bug on the JS side...
        py_lines = []
        py_imports = []
        with open(filename, "r") as f:
            for ln in f:
                py_lines.append(ln)
                if ln.startswith("import "):
                    py_imports.append(ln.split()[1])
                if ln.startswith("from "):
                    impname = ln.split()
                    impname = impname[1] + "." + impname[3]
                    py_imports.append(impname)
        kwds = {
            "py_code": repr("".join(py_lines)),
            "py_imports": repr(py_imports),
        }
        runner = self.benv.benchpath("b_py", "runner.js")
        with self._templated_file(runner, **kwds) as t_filename:
            cmd = [self.js_shell, t_filename]
            output = self.benv.bt(cmd).strip()
        if not output:
            raise RuntimeError("No output from {}".format(cmd))
        try:
            return [float(res.strip()) for res in output.split()]
        except ValueError:
            print "ERROR:", output
            raise

    @contextlib.contextmanager
    def _templated_file(self, filename, **kwds):
        kwds.setdefault("js_shell", self.js_shell)
        kwds.setdefault("pypyjs_build", self.pypyjs_build)
        kwds.setdefault("pypyjs_lib", self.pypyjs_lib)
        with open(filename, "r") as fTemplate:
            contents = fTemplate.read()
        # Javascript code has lots of curly brackets, so we can't
        # really use native string formatting for this.  Instead we
        # hack our own simple version of {{NAME}} replacement.
        for name, value in kwds.iteritems():
            contents = contents.replace("{{"+name+"}}", value)
        with tempfile.NamedTemporaryFile() as fOut:
            fOut.write(contents)
            fOut.flush()
            yield fOut.name
