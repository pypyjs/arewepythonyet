$(document).ready(function() {

  var cfg_show_js = new AWPY.ConfigOption("js", {
    default: "on"
  });
  cfg_show_js.add_widget("#config-trend-show-js");
  cfg_show_js.add_widget("#config-breakdown-show-js");
  cfg_show_js.add_widget("#config-itrend-show-js");
  cfg_show_js.add_widget("#config-detail-show-js");

  var cfg_show_d8 = new AWPY.ConfigOption("d8", {
    default: "on"
  });
  cfg_show_d8.add_widget("#config-trend-show-d8");
  cfg_show_d8.add_widget("#config-breakdown-show-d8");
  cfg_show_d8.add_widget("#config-itrend-show-d8");
  cfg_show_d8.add_widget("#config-detail-show-d8");

  var cfg_show_native = new AWPY.ConfigOption("native", {
    default: "off"
  });
  cfg_show_native.add_widget("#config-trend-show-native");
  cfg_show_native.add_widget("#config-breakdown-show-native");
  cfg_show_native.add_widget("#config-itrend-show-native");
  cfg_show_native.add_widget("#config-detail-show-native");

  var cfg_norm = new AWPY.ConfigOption("norm", {
    default: "cpython"
  });
  cfg_norm.add_widget("#config-breakdown-norm");
  cfg_norm.add_widget("#config-trend-norm");
  cfg_norm.add_widget("#config-itrend-norm");

  var cfg_jit = new AWPY.ConfigOption("jit", {
    default: "on"
  });
  cfg_jit.add_widget("#config-trend-jit");
  cfg_jit.add_widget("#config-breakdown-jit");
  cfg_jit.add_widget("#config-itrend-jit");
  cfg_jit.add_widget("#config-detail-jit");

  var cfg_metric = new AWPY.ConfigOption("metric", {
    default: "mean"
  });
  cfg_metric.add_widget("#config-trend-metric");
  cfg_metric.add_widget("#config-breakdown-metric");
  cfg_metric.add_widget("#config-itrend-metric");

  var cfg_benchmark = new AWPY.ConfigOption("benchmark");
  AWPY.fetch("data/summary/summary.json").then(function(summary) {
    var options = [];
    for (var b_name in summary.py.benchmarks) {
      options.push("<option>");
      options.push(b_name);
      options.push("</option>");
    }
    if (!cfg_benchmark.value && options.length > 0) {
      cfg_benchmark.set(options[1]);
    }
    var options_str = options.join("");
    $("#config-itrend-benchmark").html(options_str);
    cfg_benchmark.add_widget("#config-itrend-benchmark");
    $("#config-detail-benchmark").html(options_str);
    cfg_benchmark.add_widget("#config-detail-benchmark");
  });

  // Helper functions for selecting engines based on
  // the config settings.

  function cfg_norm_jit() {
    if (cfg_norm.value === "pypy" && cfg_jit.value !== "on") {
      return "pypy-nojit";
    }
    return cfg_norm.value;
  }

  function cfg_engines() {
    var engines = [];
    if (cfg_show_js.value === "on") {
      engines.push("js+pypy");
    }
    if (cfg_show_d8.value === "on") {
      engines.push("d8+pypy");
    }
    if (cfg_show_native.value === "on") {
      engines.push("pypy");
    }
    if (cfg_jit.value !== "on") {
      for (var i = 0; i < engines.length; i++) {
        engines[i] += "-nojit";
      }
    }
    return engines;
  }

  // Bar graph showing current status of each python benchmark,
  // normalized to the selected native python interpreter.

  var pyBenchBreakdown = new AWPY.Graph({
    chart_type: "bar",
    bar_orientation: "vertical",
    target: "#graph-py-breakdown",
    x_accessor: "label",
    y_accessor: "value",
    y_label: function() {
      return "runtime (normalized to " + cfg_norm_jit() + ")";
    },
    baseline_accessor: "baseline",
    data: function() {
      return AWPY.fetch("data/summary/summary.json").then((function(summary) {
        var data = [];
        var product = 1;
        var norm = cfg_norm_jit();
        var engines = cfg_engines();
        var metric = cfg_metric.value;
        if (!engines.length) {
          $("#compare-breakdown-mean").text("undefined");
          return undefined;
        }
        BENCHMARKS: for (var b_name in summary.py.benchmarks) {
          var b_res = summary.py.benchmarks[b_name];
          if (!b_res.engines[norm]) continue;
          for (var i = 0; i < engines.length; i++) {
            if (!b_res.engines[engines[i]]) {
              continue BENCHMARKS;
            }
          }
          var b_norm = b_res.engines[norm][metric];
          var b_value = 0;
          for (var i = 0; i < engines.length; i++) {
            b_value += b_res.engines[engines[i]][metric];
          }
          b_value = (b_value / engines.length) / b_norm;
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
          txt += " times slower than " + norm;
        } else if (geo_mean < 0.95) {
          txt += Math.round((1 / geo_mean) * 10) / 10;
          txt += " times faster than " + norm;
        } else {
          txt += "the same as " + norm;
        }
        $("#compare-breakdown-mean").text(txt);
        return data;
      }).bind(this))
    }
  });


  // Geometric mean of performance over time, normalized to native.

  var pyBenchMeanTrend = new AWPY.Graph({
    legend: function() {
      var engines = cfg_engines();
      var norm = cfg_norm_jit();
      var dup_norm_idx = engines.indexOf(norm);
      if (dup_norm_idx >= 0) {
        engines.splice(dup_norm_idx, 1);
      }
      engines.unshift(norm)
      return engines;
    },
    target: "#graph-trend",
    legend_target: "#legend-trend",
    x_accessor: "timestamp",
    y_accessor: "value",
    y_label: function() {
      return "runtime (normalized to " + cfg_norm_jit() + ")";
    },
    data: function() {
      return AWPY.fetch("data/summary/py/geometric_mean.json").then((function(data) {
        var norm = cfg_norm_jit();
        var metric = cfg_metric.value;
        var b_means = data.values;
        var b_means_norm = {};
        for (var i = b_means.length - 1; i >= 0; i--) {
          var b_norm = b_means[i].engines[norm][metric];
          for (var e_name in b_means[i].engines) {
            var e_means_norm = b_means_norm[e_name];
            if (!e_means_norm) {
              e_means_norm = b_means_norm[e_name] = [];
            }
            e_means_norm.push({
              timestamp: b_means[i].timestamp,
              value: b_means[i].engines[e_name][metric] / b_norm
            });
          }
        }
        var data = [];
        this.options.legend().forEach(function(engine) {
          data.push(b_means_norm[engine]);
        });
        console.log("DATA", norm, data);
        return data;
      }).bind(this));
    }
  });

  // Graph of the performance of a specific benchmark over a run.
  // This is good for seeing how the JIT kicks in over running time.

  var pyBenchRunDetail = new AWPY.Graph({
    legend: function() {
      var engines = cfg_engines();
      var norm = cfg_norm_jit();
      var dup_norm_idx = engines.indexOf(norm);
      if (dup_norm_idx >= 0) {
        engines.splice(dup_norm_idx, 1);
      }
      engines.unshift(norm)
      return engines;
    },
    target: "#graph-detail-run",
    legend_target: "#legend-detail-run",
    x_accessor: "sequence",
    y_accessor: "value",
    x_label: "iteration # in run",
    y_label: "runtime (seconds)",
    data: function() {
      var engines = this.options.legend();
      return AWPY.fetch("data/summary/summary.json").then(function(summary) {
        var latest_bench = "data/bench/";
        latest_bench += summary.timestamp + "-" + summary.platform;
        latest_bench += "-" + summary.machine + ".json";
        return AWPY.fetch(latest_bench).then(function(bench) {
          var data = [];
          var e_runs = bench.benchmarks.py[cfg_benchmark.value];
          engines.forEach(function(e_name) {
            var e_data = [];
            if (!e_runs[e_name]) {
              e_data.push({
                sequence: 1,
                value: -1
              });
            } else {
              for (var i = 0; i < e_runs[e_name][0].length; i++) {
                e_data.push({
                  sequence: i + 1,
                  value: e_runs[e_name][0][i]
                });
              }
            }
            data.push(e_data);
          });
          return data;
        });
      });
    }
  });

  // Graph of performance over time for a particular benchmark.

  var pyBenchTrendDetail = new AWPY.Graph({
    legend: function() {
      var engines = cfg_engines();
      var norm = cfg_norm_jit();
      var dup_norm_idx = engines.indexOf(norm);
      if (dup_norm_idx >= 0) {
        engines.splice(dup_norm_idx, 1);
      }
      engines.unshift(norm)
      return engines;
    },
    target: "#graph-detail-trend",
    legend_target: "#legend-detail-trend",
    x_accessor: "timestamp",
    y_accessor: "value",
    y_label: function() {
      return "runtime (normalized to " + cfg_norm_jit() + ")";
    },
    data: function() {
      var benchmark = cfg_benchmark.value;
      var filenm = "data/summary/py/benchmarks/" + benchmark + ".json";
      return AWPY.fetch(filenm).then((function(data) {
        var norm = cfg_norm_jit();
        var metric = cfg_metric.value;
        var values = data.values;
        var b_values_norm = {};
        for (var i = values.length - 1; i >= 0; i--) {
          var b_norm = values[i].engines[norm][metric];
          for (var e_name in values[i].engines) {
            var e_values_norm = b_values_norm[e_name];
            if (!e_values_norm) {
              e_values_norm = b_values_norm[e_name] = [];
            }
            e_values_norm.push({
              timestamp: values[i].timestamp,
              value: values[i].engines[e_name][metric] / b_norm
            });
          }
        }
        var data = [];
        this.options.legend().forEach(function(engine) {
          data.push(b_values_norm[engine]);
        });
        return data;
      }).bind(this));
    }
  });


  AWPY.draw_all_the_graphs();

});
