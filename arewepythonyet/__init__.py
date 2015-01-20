import os
import sys
import json
import math

from arewepythonyet.bench import bench


def main(argv):
    # XXX TODO: use argparse
    cmd = argv[1]
    if len(argv) <= 2:
        root_dir = os.path.dirname(os.path.abspath(__file__))
    elif len(argv) == 3:
        root_dir = os.path.abspath(argv[2])
    else:
        raise ValueError("at most two argv required")
    if cmd == "bench":
        do_bench(root_dir)
    elif cmd == "summarize":
        do_summarize(root_dir)
    else:
        raise ValueError("unknown command {}".format(cmd))
    return 0


def do_bench(root_dir):
    results = bench(root_dir)
    res_dir = os.path.join(root_dir, "website", "data", "bench")
    if not os.path.isdir(res_dir):
        os.makedirs(res_dir)
    res_filename = "{timestamp}-{platform}-{fingerprint}.json".format(
        timestamp=results["timestamp"],
        platform=results["machine_details"]["platform"],
        fingerprint=results["machine_details"]["fingerprint"],
    )
    with open(os.path.join(res_dir, res_filename), "w") as res_file:
        json.dump(results, res_file,
            ensure_ascii=True,
            allow_nan=False,
            sort_keys=True,
            indent=4,
        )


def do_summarize(root_dir):
    summary_dir = os.path.join(root_dir, "website", "data", "summary")
    if not os.path.isdir(summary_dir):
        os.makedirs(summary_dir)
    # Load up all the available bench results.
    bench_dir = os.path.join(root_dir, "website", "data", "bench")
    results = []
    for (dirnm, _, filenms) in os.walk(bench_dir):
        for filenm in filenms:
            with open(os.path.join(dirnm, filenm), "r") as f:
                results.append(json.load(f))
    
    if not results:
        raise ValueError("no bench result found")
    # Process in increasing timestamp order, so that it's easy
    # to keep a running summary of latest result for each machine.
    results.sort(key=lambda r: r["timestamp"])
    # We'll gather summary metadata into this dict as we go.
    summary = {
        "timestamp": results[-1]["timestamp"],
        "machine": results[-1]["machine_details"]["fingerprint"],
        "platform": results[-1]["machine_details"]["platform"],
    }
    # For each py benchmark, take the min, max, and best arithmetic mean
    # across all available runs.  Combine them into a single summary using
    # geometric mean, so that we can easily normalize for display.
    py_mean_series = []
    py_benchmarks = {}
    prev_results = {}
    for res in results:
        res_benchmarks = res["benchmarks"]["py"]
        res_means = {}
        for b_name in res_benchmarks:
            b_series = py_benchmarks.setdefault(b_name, [])
            b_summary = {
                "timestamp": res["timestamp"],
                "machine": res["machine_details"]["fingerprint"],
                "platform": results[-1]["machine_details"]["platform"],
                "engines": {},
            }
            for e_name in res_benchmarks[b_name]:
                # For runs in which a particular (benchmark, engine) run failed
                # we use the previous result from that machine.
                prev_res_key = (b_summary["machine"], b_name, e_name)
                runs = res_benchmarks[b_name][e_name]
                if runs is None:
                    e_summary = prev_results.get(prev_res_key)
                    if e_summary is None:
                        continue
                else:
                    e_summary = {
                        "mean": min(arithmetic_mean(run) for run in runs),
                        "min": min(min(run) for run in runs),
                        "max": max(max(run) for run in runs),
                    }
                    e_summary = prev_results[prev_res_key] = e_summary
                b_summary["engines"][e_name] = e_summary
                res_means.setdefault(e_name, []).append(e_summary)
            b_series.append(b_summary)
        for e_name in res_means:
            res_means[e_name] = {
                "mean": geometric_mean(r["mean"] for r in res_means[e_name]),
                "min": geometric_mean(r["min"] for r in res_means[e_name]),
                "max": geometric_mean(r["max"] for r in res_means[e_name]),
            }
        py_mean_series.append({
            "timestamp": res["timestamp"],
            "machine": res["machine_details"]["fingerprint"],
            "platform": results[-1]["machine_details"]["platform"],
            "engines": res_means,
        })
    # Include the latest results in the summary data.
    summary["py"] = {
        "geometric_mean": py_mean_series[-1],
        "benchmarks": dict((b[0], b[1][-1]) for b in py_benchmarks.iteritems()),
    }
    # Write out the full timeseries for each benchmark to a separate file.
    # For this purpose, we put the latest timestamp first.
    py_dir = os.path.join(summary_dir, "py")
    if not os.path.isdir(py_dir):
        os.makedirs(py_dir)
    with open(os.path.join(py_dir, "geometric_mean.json"), "w") as f:
        json_dump({"values": list(reversed(py_mean_series))}, f)
    pybench_dir = os.path.join(py_dir, "benchmarks")
    if not os.path.isdir(pybench_dir):
        os.makedirs(pybench_dir)
    for b_name, b_series in py_benchmarks.iteritems():
        with open(os.path.join(pybench_dir, b_name + ".json"), "w") as f:
            json_dump({"values": list(reversed(b_series))}, f)
    # For each misc benchmark, we just re-order into a timeseries of means.
    misc_benchmarks = {}
    for res in reversed(results):
        res_misc = res["benchmarks"]["misc"]
        for b_name in res_misc:
            b_series = misc_benchmarks.setdefault(b_name, [])
            b_summary = {
                "timestamp": res["timestamp"],
                "machine": res["machine_details"]["fingerprint"],
                "platform": results[-1]["machine_details"]["platform"],
                "engines": {},
            }
            for e_name in res_misc[b_name]:
                runs = res_misc[b_name][e_name]
                if runs is None:
                    continue
                if isinstance(runs, (int, long, float)):
                    runs = [[runs]]
                b_summary["engines"][e_name] = {
                    "mean": min(arithmetic_mean(run) for run in runs),
                    "min": min(min(run) for run in runs),
                    "max": max(max(run) for run in runs),
                }
            b_series.append(b_summary)
    summary["misc"] = {
        "benchmarks": dict((b[0], b[1][-1]) for b in misc_benchmarks.iteritems()),
    }
    # Write out the full timeseries for each benchmark to a separate file.
    misc_dir = os.path.join(summary_dir, "misc", "benchmarks")
    if not os.path.isdir(misc_dir):
        os.makedirs(misc_dir)
    for b_name, b_series in misc_benchmarks.iteritems():
        with open(os.path.join(misc_dir, b_name + ".json"), "w") as f:
            json_dump({"values": b_series}, f)
    # Write out the summary data.
    with open(os.path.join(summary_dir, "summary.json"), "w") as f:
        json_dump(summary, f)


def json_dump(data, f):
    json.dump(data, f,
        ensure_ascii=True,
        allow_nan=False,
        sort_keys=True,
        indent=4,
    )


def geometric_mean(results):
    count = 0
    product = 1
    for res in results:
        product *= res
        count += 1
    return math.pow(product, 1.0 / count)


def arithmetic_mean(results):
    total = 0.0
    count = 0
    for res in results:
        total += res
        count += 1
    return total / count
