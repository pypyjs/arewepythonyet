$(document).ready(function() {

  var cfg_compare = new AWPY.ConfigOption("compare", {
    default: "all"
  });
  cfg_compare.add_widget("#config-breakdown-compare");

  var cfg_norm = new AWPY.ConfigOption("norm", {
    default: "cpython"
  });
  cfg_norm.add_widget("#config-breakdown-norm");

  var cfg_jit = new AWPY.ConfigOption("jit", {
    default: "on"
  });
  cfg_jit.add_widget("#config-breakdown-jit");

  // Helper functions for selecting engines based on
  // the config settings.

  function cfg_norm_jit() {
    if (cfg_norm.value === "pypy" && cfg_jit.value !== "on") {
      return "pypy-nojit";
    }
    return cfg_norm.value;
  }

  function cfg_js_engines() {
    if (cfg_compare.value == "all") {
      js_engines = ["js+pypy", "d8+pypy"];
    } else {
      js_engines = [cfg_compare.value];
    }
    if (cfg_jit.value !== "on") {
      for (var i = 0; i < js_engines.length; i++) {
        js_engines[i] += "-nojit";
      }
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
    bar_orientation: "vertical",
    target: "#graph-py-breakdown",
    x_accessor: "label",
    y_accessor: "value",
    y_label: function() {
      return "runtime (normalized to " + cfg_norm_jit() + ")";
    },
    baseline_accessor: "baseline",
    data: function() {
      console.log("FETCHING");
      return AWPY.fetch("data/summary.json").then((function(summary) {
        var data = [];
        var product = 1;
        var norm = cfg_norm_jit();
        var js_engines = cfg_js_engines();
        BENCHMARKS: for (var b_name in summary.py.benchmarks) {
          var b_res = summary.py.benchmarks[b_name];
          if (!b_res[0].engines[norm]) continue;
          for (var i = 0; i < js_engines.length; i++) {
            if (!b_res[0].engines[js_engines[i]]) {
              continue BENCHMARKS;
            }
          }
          var b_norm = b_res[0].engines[norm].mean;
          var b_value = 0;
          for (var i = 0; i < js_engines.length; i++) {
            b_value += b_res[0].engines[js_engines[i]].mean;
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
        var txt;
        if (geo_mean >= 1) {
          txt = Math.round(geo_mean * 10) / 10;
          txt += " times slower than " + norm;
        } else {
          txt = Math.round((1 / geo_mean) * 10) / 10;
          txt += " times faster than " + norm;
        }
        $("#compare-py-trend").text(txt);
        return data;
      }).bind(this))
    }
  });

  AWPY.draw_all_the_graphs();

});
