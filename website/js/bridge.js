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
    for (var b_name in summary.bridge.benchmarks) {
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

  function cfg_engines() {
    var engines = [];
    if (cfg_show_js.value === "on") {
      engines.push("js+pypy");
    }
    if (cfg_show_d8.value === "on") {
      engines.push("d8+pypy");
    }
    if (cfg_jit.value !== "on") {
      for (var i = 0; i < engines.length; i++) {
        engines[i] += "-nojit";
      }
    }
    return engines;
  }

  // Bar graph showing current status of each js-bridge benchmark,
  // normalized to performance of equivalent native javascript.

  var bridgeBenchBreakdown = new AWPY.Graph({
    chart_type: "bar",
    bar_orientation: "vertical",
    target: "#graph-bridge-breakdown",
    x_accessor: "label",
    y_accessor: "value",
    y_label: "runtime (normalized to equivalent native js)",
    baseline_accessor: "baseline",
    data: function() {
      return AWPY.fetch("data/summary/summary.json").then((function(summary) {
        var data = [];
        var product = 1;
        var engines = cfg_engines();
        var metric = cfg_metric.value;
        if (!engines.length) {
          $("#compare-breakdown-mean").text("undefined");
          return undefined;
        }
        BENCHMARKS: for (var b_name in summary.bridge.benchmarks) {
          var b_res = summary.bridge.benchmarks[b_name];
          for (var i = 0; i < engines.length; i++) {
            if (!b_res.engines[engines[i]]) {
              continue BENCHMARKS;
            }
          }
          var b_product = 1;
          for (var i = 0; i < engines.length; i++) {
            b_product = b_product * b_res.engines[engines[i]][metric];
          }
          b_value = Math.pow(b_product, 1 / engines.length);
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
          txt += " times slower than native js";
        } else if (geo_mean < 0.95) {
          txt += Math.round((1 / geo_mean) * 10) / 10;
          txt += " times faster than native js";
        } else {
          txt += "the same as native js";
        }
        $("#compare-breakdown-mean").text(txt);
        return data;
      }).bind(this))
    }
  });


  // Geometric mean of performance over time, normalized to native js.

  var bridgeBenchMeanTrend = new AWPY.Graph({
    legend: function() {
      return cfg_engines();
    },
    target: "#graph-trend",
    legend_target: "#legend-trend",
    x_accessor: "timestamp",
    y_accessor: "value",
    y_label: "runtime (normalized to equivalent native js)",
    data: function() {
      return AWPY.fetch("data/summary/bridge/geometric_mean.json").then((function(data) {
        var metric = cfg_metric.value;
        var b_means = data.values;
        var data = [];
        this.options.legend().forEach(function(engine) {
          var e_means = [];
          for (var i = b_means.length - 1; i >= 0; i--) {
            if (!b_means[i].engines[engine]) {
              continue;
            }
            e_means.push({
              timestamp: b_means[i].timestamp,
              value: b_means[i].engines[engine][metric]
            });
          }
          data.push(e_means);
        });
        return data;
      }).bind(this));
    }
  });

  // Graph of the performance of a specific benchmark over a run.
  // This is good for seeing how the JIT kicks in over running time.

  var bridgeBenchRunDetail = new AWPY.Graph({
    legend: function() {
      return cfg_engines();
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
          var e_runs = bench.benchmarks.bridge[cfg_benchmark.value];
          engines.forEach(function(e_name) {
            var e_data = [];
            if (!e_runs.py[e_name]) {
              e_data.push({
                sequence: 1,
                value: -1
              });
            } else {
              for (var i = 0; i < e_runs.py[e_name][0].length; i++) {
                e_data.push({
                  sequence: i + 1,
                  value: e_runs.py[e_name][0][i]
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

  var bridgeBenchTrendDetail = new AWPY.Graph({
    legend: function() {
      return cfg_engines();
    },
    target: "#graph-detail-trend",
    legend_target: "#legend-detail-trend",
    x_accessor: "timestamp",
    y_accessor: "value",
    y_label: "runtime (normalized to equivalent native js)",
    data: function() {
      var benchmark = cfg_benchmark.value;
      var filenm = "data/summary/bridge/benchmarks/" + benchmark + ".json";
      return AWPY.fetch(filenm).then((function(data) {
        var metric = cfg_metric.value;
        var values = data.values;
        var b_values = {};
        for (var i = values.length - 1; i >= 0; i--) {
          for (var e_name in values[i].engines) {
            var e_values = b_values[e_name];
            if (!e_values) {
              e_values = b_values[e_name] = [];
            }
            e_values.push({
              timestamp: values[i].timestamp,
              value: values[i].engines[e_name][metric]
            });
          }
        }
        var data = [];
        this.options.legend().forEach(function(engine) {
          data.push(b_values[engine]);
        });
        return data;
      }).bind(this));
    }
  });

  AWPY.draw_all_the_graphs();

});
