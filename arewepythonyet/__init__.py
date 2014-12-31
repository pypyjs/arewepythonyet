
import os
import json
import shutil
import tempfile
from datetime import datetime


def main(argv):
    # XXX TODO: use argparse
    if len(argv) <= 1:
        root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    elif len(argv) == 2:
        root_dir = os.path.abspath(argv[1])
    else:
        raise ValueError("at most one argv required")
    timestamp = datetime.utcnow().isoformat()
    machine_id = "ABCDEF"
    res_dir = os.path.join(root_dir, "results")
    res_filename = "{}_{}.json".format(timestamp, machine_id)
    res_file = open(os.path.join(res_dir, res_filename), "w")
    try:
        results = run_benchmarks(root_dir)
        results["timestamp"] = timestamp
        results["machine_id"] = machine_id
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


def run_benchmarks(root_dir):
    return { "benchmarks": {
        "file_size": run_benchmark_file_size(root_dir),
        "load_time": run_benchmark_load_time(root_dir),
        "pystone": run_benchmark_pystone(root_dir),
    }}


def run_benchmark_file_size(root_dir):
    return None


def run_benchmark_load_time(root_dir):
    return None


def run_benchmark_pystone(root_dir):
    return None


