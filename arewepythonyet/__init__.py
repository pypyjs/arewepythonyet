import os
import sys
import json

from arewepythonyet.bench import bench


def main(argv):
    # XXX TODO: use argparse
    if len(argv) <= 1:
        root_dir = os.path.dirname(os.path.abspath(__file__))
    elif len(argv) == 2:
        root_dir = os.path.abspath(argv[1])
    else:
        raise ValueError("at most one argv required")
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
