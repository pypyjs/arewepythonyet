
import os
import sys
import json
import shutil
import tempfile
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
    res_filename = "trial-{timestamp}-{platform}-{fingerprint}.json".format(
        timestamp=timestamp,
        platform=machine_details["platform"],
        fingerprint=machine_details["fingerprint"],
    )
    res_dir = os.path.join(root_dir, "results")
    res_file = open(os.path.join(res_dir, res_filename), "w")
    try:
        results = run_benchmarks(root_dir)
        results["timestamp"] = timestamp
        results["machine_details"] = machine_details
        # XXX TODO: include build versions of pypy, python, js, d8, etc
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


def run_benchmarks(root_dir):
    return { "benchmarks": {
        "file_size": run_benchmark_file_size(root_dir),
        "load_time": run_benchmark_load_time(root_dir),
        "pystone": run_benchmark_pystone(root_dir),
    }}


def find_js_file(name):
    return os.path.join(os.path.dirname(__file__), name)


def find_exe(root_dir, name):
    return os.path.join(root_dir, "build", "bin", name)


def _run_js_benchmark(root_dir, name, exe):
    results = []
    js_file = find_js_file(name)
    exe_file = find_exe(root_dir, exe)
    for _ in xrange(6):
        p = subprocess.Popen([exe_file, js_file], stdout=subprocess.PIPE)
        stdout, _ = p.communicate()
        if p.returncode != 0:
            raise RuntimeError("subprocess failed")
        results.append(int(stdout.strip()))
    return results


def run_benchmark_file_size(root_dir):

    def get_size(build, name):
        path = os.path.join(root_dir, "build", "lib", build, "lib", name)
        return os.stat(path).st_size

    def get_compressed_size(build, name):
        path = os.path.join(root_dir, "build", "lib", build, "lib", name)
        subprocess.check_call(["gzip", "-9", "--keep", "--force", path])
        return os.stat(path + ".gz").st_size

    results = {}
    for build in ("pypy", "pypy-nojit"):
        results[build] = {}
        for name in ("pypy.vm.js", "pypy.vm.js.mem"):
            results[build][name] = {
                "raw": get_size(build, name),
                "gz": get_compressed_size(build, name),
            }

    return results


def run_benchmark_load_time(root_dir):
    results = {
        "js": _run_js_benchmark(root_dir, "load_time.js", "js"),
        "d8": _run_js_benchmark(root_dir, "load_time.js", "d8"),
    }
    return results


def run_benchmark_pystone(root_dir):
    return None

