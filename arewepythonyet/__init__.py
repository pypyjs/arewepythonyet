import os
import sys
import json
import math
import operator

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
    res_dir = os.path.join(root_dir, "results", "bench")
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
    # Load up all the available bench results.
    bench_dir = os.path.join(root_dir, "results", "bench")
    results = []
    for (dirnm, _, filenms) in os.walk(bench_dir):
        for filenm in filenms:
            with open(os.path.join(dirnm, filenm), "r") as f:
                results.append(json.load(f))
    
    if not results:
        raise ValueError("no bench result found")
    # Process in order of most recent timestamp.
    results.sort(key=lambda r: r["timestamp"], reverse=True)
    # Summary metadata.
    summary = {
        "latest_timestamp": results[0]["timestamp"],
    }
    # For each py benchmark, take the best arithmetic mean across
    # all available runs.  Combine them into a single summary using
    # geometric mean, so that we can easily normalize for display.
    summary["py"] = {
        "geometric_mean": [],
        "benchmarks": {},
    }
    for res in results:
        res_benchmarks = res["benchmarks"]["py"]
        res_means = {}
        for b_name in res_benchmarks:
            b_timeseries = summary["py"]["benchmarks"].setdefault(b_name, [])
            b_summary = {
                "timestamp": res["timestamp"],
                "engines": {},
            }
            for e_name in res_benchmarks[b_name]:
                runs = res_benchmarks[b_name][e_name]
                if runs is None:
                    continue
                mean = min(arithmetic_mean(run) for run in runs)
                b_summary["engines"][e_name] = {
                    "mean": mean,
                    "min": min(min(run) for run in runs),
                    "max": max(max(run) for run in runs),
                }
                res_means.setdefault(e_name, []).append(mean)
            b_timeseries.append(b_summary)
        for e_name in res_means:
            res_means[e_name] = {
                "value": geometric_mean(res_means[e_name])
            }
        summary["py"]["geometric_mean"].append({
            "timestamp": res["timestamp"],
            "engines": res_means,
        })
    # For each misc benchmark, we just re-order into a timeseries of means.
    summary["misc"] = {}
    for res in results:
        res_misc = res["benchmarks"]["misc"]
        for b_name in res_misc:
            b_timeseries = summary["misc"].setdefault(b_name, [])
            b_summary = {
                "timestamp": res["timestamp"],
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
            b_timeseries.append(b_summary)
    # Write it out.
    summary_dir = os.path.join(root_dir, "results", "summary")
    if not os.path.isdir(summary_dir):
        os.makedirs(summary_dir)
    with open(os.path.join(summary_dir, "summary.json"), "w") as f:
        json.dump(summary, f,
            ensure_ascii=True,
            allow_nan=False,
            sort_keys=True,
            indent=4,
        )


def geometric_mean(results):
    return math.pow(reduce(operator.mul, results, 1), 1.0 / len(results))


def arithmetic_mean(results):
    return sum(results) / float(len(results))
