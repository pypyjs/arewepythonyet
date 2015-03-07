$(document).ready(function() {

  // There are two configuration options for this page.
  //   norm: what native interpreter to normalize to
  //   jit:  whether to compare pypy with or without JIT

  var cfg_norm = new AWPY.ConfigOption("norm", {
    default: "cpython"
  });
  cfg_norm.add_widget("#config-py-norm");

  var cfg_jit = new AWPY.ConfigOption("jit", {
    default: "on"
  });
  cfg_jit.add_widget("#config-py-jit");
  cfg_jit.add_widget("#config-startup-jit");
  cfg_jit.add_widget("#config-bridge-jit");

  // Helper functions for selecting engines based on
  // the config settings.

  function cfg_norm_jit() {
    if (cfg_norm.value === "pypy" && cfg_jit.value !== "on") {
      return "pypy-nojit";
    }
    return cfg_norm.value;
  }

  function cfg_js_engines() {
    if (cfg_jit.value === "on") {
      js_engines = ["js+pypy", "d8+pypy"];
    } else {
      js_engines = ["js+pypy-nojit", "d8+pypy-nojit"];
    }
    return js_engines;
  }

  // Bar graph showing current status of each python benchmark,
  // normalized to the selected native python interpreter.

  var pyBenchBreakdown = new AWPY.Graph({
    title: "Individual benchmarks",
    description: function() {
      desc = "Mean time for each python benchmark,";
      desc += " normalized to " + cfg_norm_jit();
      return desc
    },
    chart_type: "bar",
    target: "#graph-py-breakdown",
    x_accessor: "value",
    y_accessor: "label",
    x_label: function() {
      return "runtime (normalized to " + cfg_norm_jit() + ")";
    },
    baseline_accessor: "baseline",
    data: function() {
      return AWPY.fetch("data/summary/summary.json").then((function(summary) {
        var data = [];
        var product = 1;
        var norm = cfg_norm_jit();
        var js_engines = cfg_js_engines();
        BENCHMARKS: for (var b_name in summary.py.benchmarks) {
          var b_res = summary.py.benchmarks[b_name];
          if (!b_res.engines[norm]) continue;
          for (var i = 0; i < js_engines.length; i++) {
            if (!b_res.engines[js_engines[i]]) {
              continue BENCHMARKS;
            }
          }
          var b_norm = b_res.engines[norm].mean;
          var b_value = 0;
          for (var i = 0; i < js_engines.length; i++) {
            b_value += b_res.engines[js_engines[i]].mean;
          }
          b_value = (b_value / js_engines.length) / b_norm;
          data.push({
            label: b_name,
            value: b_value,
            baseline: 1,
          });
          product = product * b_value;
        }
        var geo_mean = Math.pow(product, 1 / data.length);
        var txt = "around ";
        if (geo_mean > 1.05) {
          txt += Math.round(geo_mean * 10) / 10;
          txt += " times slower than";
        } else if (geo_mean < 0.95) {
          txt += Math.round((1 / geo_mean) * 10) / 10;
          txt += " times faster than";
        } else {
          txt += "the same as";
        }
        txt += " " + norm;
        $("#compare-py-trend").text(txt);
        return data;
      }).bind(this))
    }
  });

  // Geometric mean of performance over time, normalized to native.

  var pyBenchMeanTrend = new AWPY.Graph({
    title: "Mean performance over time",
    description: function() {
      desc = "Mean time across all benchmarks, over time, ";
      desc += "normalized to " + cfg_norm_jit();
      return desc
    },
    legend: function() {
      if (cfg_jit.value === "on") {
        return [cfg_norm_jit(), "js+pypy", "d8+pypy"];
      } else {
        return [cfg_norm_jit(), "js+pypy-nojit", "d8+pypy-nojit"];
      }
    },
    target: "#graph-py-trend",
    legend_target: "#legend-py-trend",
    x_accessor: "timestamp",
    y_accessor: "value",
    y_label: function() {
      return "runtime (normalized to " + cfg_norm_jit() + ")";
    },
    data: function() {
      return AWPY.fetch("data/summary/py/geometric_mean.json").then((function(data) {
        var norm = cfg_norm_jit();
        var b_means = data.values;
        var b_means_norm = {};
        for (var i = b_means.length - 1; i >= 0; i--) {
          var b_norm = b_means[i].engines[norm].mean;
          for (var e_name in b_means[i].engines) {
            var e_means_norm = b_means_norm[e_name];
            if (!e_means_norm) {
              e_means_norm = b_means_norm[e_name] = [];
            }
            e_means_norm.push({
              timestamp: b_means[i].timestamp,
              value: b_means[i].engines[e_name].mean / b_norm
            });
          }
        }
        return [
          b_means_norm[norm],
          b_means_norm["js+pypy" + (cfg_jit.value === "on" ? "" : "-nojit")],
          b_means_norm["d8+pypy" + (cfg_jit.value === "on" ? "" : "-nojit")]
        ]
      }).bind(this));
    }
  });

  // Total download size of core interpreter files.

  var miscDownloadSize = new AWPY.Graph({
    title: "Download Size",
    description: "Total size of all core interpreter files, over time",
    target: "#graph-file-size",
    x_accessor: "timestamp",
    y_accessor: "value",
    y_label: "download size (bytes)",
    legend: ["raw", "gz"],
    legend_target: "#legend-file-size",
    data: function() {
      return AWPY.fetch("data/summary/misc/benchmarks/file_size_raw.json").then((function(ts_raw) {
        return AWPY.fetch("data/summary/misc/benchmarks/file_size_gz.json").then((function(ts_gz) {
          var data_raw = [];
          var engine = "pypy" + (cfg_jit.value === "on" ? "" : "-nojit");
          var results = ts_raw["values"];
          for (var i = results.length - 1; i >= 0; i--) {
            data_raw.push({
              "timestamp": results[i]["timestamp"],
              "value": results[i].engines[engine].mean,
            });
          }
          var data_gz = [];
          var results = ts_gz["values"];
          for (var i = results.length - 1; i >= 0; i--) {
            data_gz.push({
              "timestamp": results[i]["timestamp"],
              "value": results[i].engines[engine].mean,
            });
          }
          return [data_raw, data_gz];
        }).bind(this));
      }).bind(this));
    }
  });

  // Time taken to load and initialize the interpreter.

  var miscLoadTime = new AWPY.Graph({
    title: "Load Time",
    description: "Time to load and initialize the core interpreter, over time",
    target: "#graph-load-time",
    legend: ["js+pypy", "d8+pypy"],
    legend_target: "#legend-load-time",
    x_accessor: "timestamp",
    y_accessor: "value",
    y_label: "load time (seconds)",
    data: function() {
      return AWPY.fetch("data/summary/misc/benchmarks/load_time.json").then((function(ts) {
        var engine = "pypy" + (cfg_jit.value === "on" ? "" : "-nojit");
        var data_js = [];
        var results = ts["values"];
        for (var i = results.length - 1; i >= 0; i--) {
          data_js.push({
            "timestamp": results[i]["timestamp"],
            "value": results[i].engines["js+" + engine].mean,
          });
        }
        var data_d8 = [];
        var results = ts["values"];
        for (var i = results.length - 1; i >= 0; i--) {
          data_d8.push({
            "timestamp": results[i]["timestamp"],
            "value": results[i].engines["d8+" + engine].mean,
          });
        }
        return [data_js, data_d8];
      }).bind(this));
    }
  });

  // Bar graph showing current status of each bridge benchmark.

  var bridgeBenchBreakdown = new AWPY.Graph({
    title: "Individual benchmarks",
    description: function() {
      desc = "Mean time for each python benchmark,";
      desc += " normalized to native js";
      return desc
    },
    chart_type: "bar",
    target: "#graph-bridge-breakdown",
    x_accessor: "value",
    y_accessor: "label",
    x_label: function() {
      return "runtime (normalized to equivalent native js)";
    },
    baseline_accessor: "baseline",
    data: function() {
      return AWPY.fetch("data/summary/summary.json").then((function(summary) {
        var data = [];
        var product = 1;
        var js_engines = cfg_js_engines();
        BENCHMARKS: for (var b_name in summary.bridge.benchmarks) {
          var b_res = summary.bridge.benchmarks[b_name];
          for (var i = 0; i < js_engines.length; i++) {
            if (!b_res.engines[js_engines[i]]) {
              continue BENCHMARKS;
            }
          }
          var b_product = 1;
          for (var i = 0; i < js_engines.length; i++) {
            b_product = b_product * b_res.engines[js_engines[i]].mean;
          }
          b_value = Math.pow(b_product, 1 / js_engines.length);
          data.push({
            label: b_name,
            value: b_value,
            baseline: 1,
          });
          product = product * b_value;
        }
        var geo_mean = Math.pow(product, 1 / data.length);
        var txt = "around ";
        if (geo_mean > 1.05) {
          txt += Math.round(geo_mean * 10) / 10;
          txt += " times slower than";
        } else if (geo_mean < 0.95) {
          txt += Math.round((1 / geo_mean) * 10) / 10;
          txt += " times faster than";
        } else {
          txt += "the same as";
        }
        txt += " native js";
        $("#compare-bridge-trend").text(txt);
        return data;
      }).bind(this))
    }
  });

  // Geometric mean of bridge performance over time, normalized to native js.

  var bridgeBenchMeanTrend = new AWPY.Graph({
    title: "Mean performance over time",
    description: function() {
      desc = "Mean time across all benchmarks, over time, ";
      desc += "normalized to equivalent native javascript";
      return desc
    },
    legend: function() {
      return cfg_js_engines();
    },
    target: "#graph-bridge-trend",
    legend_target: "#legend-bridge-trend",
    x_accessor: "timestamp",
    y_accessor: "value",
    y_label: function() {
      return "runtime (normalized to equivalent native js)";
    },
    data: function() {
      return AWPY.fetch("data/summary/bridge/geometric_mean.json").then((function(data) {
        var b_values = data.values;
        var b_means = {};
        for (var i = b_values.length - 1; i >= 0; i--) {
          for (var e_name in b_values[i].engines) {
            var e_means = b_means[e_name];
            if (!e_means) {
              e_means = b_means[e_name] = [];
            }
            e_means.push({
              timestamp: b_values[i].timestamp,
              value: b_values[i].engines[e_name].mean
            });
          }
        }
        var data = [];
        this.options.legend().forEach(function(engine) {
          data.push(b_means[engine]);
        });
        return data;
      }).bind(this));
    }
  });

  AWPY.draw_all_the_graphs();

});
