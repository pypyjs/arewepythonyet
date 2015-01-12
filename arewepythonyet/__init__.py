
import os
import sys
import json
import uuid
import psutil
import hashlib
import tempfile
import contextlib
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
            sort_keys=True,
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

    NUM_RUNS = 2

    def __init__(self, root_dir):
        self.root_dir = root_dir
        self.engines = []
        self.engines.append(NativeEngine(self, "cpython", "python"))
        self.engines.append(NativeEngine(self, "pypy"))
        self.engines.append(NativeEngine(self, "pypy-nojit"))
        for pypyjs_build in os.listdir(self.abspath("build", "lib")):
            lib = self.abspath("build", "lib", pypyjs_build, "lib", "pypy.js")
            if os.path.exists(lib):
                for js_shell in ("js", "d8"):
                    self.engines.append(JSEngine(self, js_shell, pypyjs_build))

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
        # Each named benchmark is a dict mapping engine names to a list
        # of numeric benchmark results.  The engine name indicates the
        # particular flavour of python as well as the javascript engine
        # in use, e.g. "cpython" or "d8+pypyjs-nojit".
        results = {}
        results["file_size_raw"] = self._run_benchmark_file_size_raw()
        results["file_size_gz"] = self._run_benchmark_file_size_gz()
        results["load_time"] = self._run_benchmark_load_time()
        results["pystone_cold"] = self._run_benchmark_pystone_cold()
        results["pystone_warm"] = self._run_benchmark_pystone_warm()
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
            results[name] = [0]
            for filename in ("pypy.js", "pypy.vm.js",):
                results[name][0] += get_size(engine, filename)
            for filename in ("pypy.vm.js.mem",):
                results[name][0] += get_size(engine, filename, ignore=True)

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
            results[name] = [0]
            for filename in ("pypy.js", "pypy.vm.js",):
                results[name][0] += get_size(engine, filename)
            for filename in ("pypy.vm.js.mem",):
                results[name][0] += get_size(engine, filename, ignore=True)

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
        return self._run_py_benchmark("pystone_cold.py")

    def _run_benchmark_pystone_warm(self):
        """Benchmark tracking pystones-per-second with warm JIT.

        This benchmark tracks the number of pystones-per-second achieved
        when allowing JIT warmup.  Larger numbers are better.

        Results are reported as pystones/second count for each js engine.
        """
        return self._run_py_benchmark("pystone_warm.py")

    def _run_js_benchmark(self, name):
        """Helper to run a js file benchmark across all engines.

        Called with the name of a javascript benchmark file, this method
        runs it in each available js engine and reports back the results.
        The file is expected to print a single number on stdout as the
        result of the benchmark.
        """
        results = {}
        js_file = os.path.join(os.path.dirname(__file__), "benchmarks", name)
        for engine in self.engines:
            try:
                results[engine.name] = list(
                    engine.run_js_benchmark(js_file) for _ in xrange(self.NUM_RUNS)
                )
            except NotImplementedError:
                pass
        return results

    def _run_py_benchmark(self, name):
        """Helper to run a py file benchmark across all engines.

        Called with the name of a python benchmark file, this method runs
        it in each available engine and reports back the results.  The
        file is expected to print a single number on stdout as the result
        of the benchmark.
        """
        results = {}
        py_file = os.path.join(os.path.dirname(__file__), "benchmarks", name)
        for engine in self.engines:
            try:
                results[engine.name] = list(
                    engine.run_py_benchmark(py_file) for _ in xrange(self.NUM_RUNS)
                )
            except NotImplementedError:
                pass
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
        return float(output)


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
        return float(output)

    def run_py_benchmark(self, filename):
        py_stmts = []
        with open(filename, "r") as f:
            for ln in f:
                py_stmts.append(repr(ln))
        py_code =")\n}).then(function(){\nreturn vm.eval(".join(py_stmts)
        py_code = "return vm.eval(" + py_code + ")"
        runner = os.path.join(os.path.dirname(__file__),
                              "benchmarks", "py_runner.js")
        with self._templated_file(runner, py_code=py_code) as t_filename:
            cmd = [self.js_shell, t_filename]
            output = self.benv.bt(cmd).strip()
        if not output:
            raise RuntimeError("No output from {}".format(cmd))
        return float(output)

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
