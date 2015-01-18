$(document).ready(function() {

  // The latest results of the python benchmarks, normalized to native.

  function cfg_norm(val) {
    if (typeof val !== "undefined") {
      $("#config-py-norm").val(val);
      $("#config-py-norm").trigger("change");
    }
    var norm = $("#config-py-norm").val();
    if (norm === "pypy" && !cfg_jit()) {
      norm = "pypy-nojit";
    }
    return norm;
  }

  function cfg_jit(val) {
    if (typeof val !== "undefined") {
      $("#config-py-jit").val(val ? "on" : "off");
      $("#config-py-jit").trigger("change");
    }
    return $("#config-py-jit").val() === "on";
  }

  function cfg_js_engines() {
    if (cfg_jit()) {
      js_engines = ["js+pypy", "d8+pypy"];
    } else {
      js_engines = ["js+pypy-nojit", "d8+pypy-nojit"];
    }
    return js_engines;
  }

  var pyBenchBreakdown = new AWPY.Graph({
    title: "Individual benchmarks",
    description: function() {
      desc = "Mean time for each python benchmark,";
      desc += " normalized to " + cfg_norm();
      return desc
    },
    chart_type: "bar",
    target: "#graph-py-breakdown",
    x_accessor: "value",
    y_accessor: "label",
    x_label: function() {
      return "runtime (normalized to " + cfg_norm() + ")";
    },
    baseline_accessor: "baseline",
    data: function() {
      return AWPY.fetch("data/summary.json").then((function(summary) {
        var data = [];
        var product = 1;
        var norm = cfg_norm();
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

  // Geometric mean of performance over time, normalized to native.

  var pyBenchMeanTrend = new AWPY.Graph({
    title: "Mean performance over time",
    config: {
      norm: "cpython",
      jit: true
    },
    description: function() {
      desc = "Mean time across all benchmarks, over time, ";
      desc += "normalized to " + cfg_norm();
      return desc
    },
    legend: function() {
      if (cfg_jit()) {
        return [cfg_norm(), "js+pypy", "d8+pypy"];
      } else {
        return [cfg_norm(), "js+pypy-nojit", "d8+pypy-nojit"];
      }
    },
    target: "#graph-py-trend",
    legend_target: "#legend-py-trend",
    x_accessor: "timestamp",
    y_accessor: "value",
    y_label: function() {
      return "runtime (normalized to " + cfg_norm() + ")";
    },
    data: function() {
      return AWPY.fetch("data/summary.json").then((function(summary) {
        var norm = cfg_norm();
        var b_means = summary.py.geometric_mean;
        var b_means_norm = {};
        for (var i = b_means.length - 1; i >= 0; i--) {
          var b_norm = b_means[i].engines[norm].value;
          for (var e_name in b_means[i].engines) {
            var e_means_norm = b_means_norm[e_name];
            if (!e_means_norm) {
              e_means_norm = b_means_norm[e_name] = [];
            }
            e_means_norm.push({
              timestamp: b_means[i].timestamp,
              value: b_means[i].engines[e_name].value / b_norm
            });
          }
        }
        return [
          b_means_norm[norm],
          b_means_norm["js+pypy" + (cfg_jit() ? "" : "-nojit")],
          b_means_norm["d8+pypy" + (cfg_jit() ? "" : "-nojit")]
        ]
      }).bind(this));
    }
  });

  $("#config-py-norm").on("change", function() {
    AWPY.to_location_var("norm", cfg_norm());
    pyBenchBreakdown.draw();
    pyBenchMeanTrend.draw();
  });

  $("#config-py-jit").on("change", function() {
    var val = cfg_jit() ? "on" : "off";
    AWPY.to_location_var("jit", val);
    if ($("#config-startup-jit").val() !== val) {
      $("#config-startup-jit").val(val);
    }
    AWPY.draw_all_the_graphs();
  });


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
      return AWPY.fetch("data/summary.json").then((function(summary) {
        var data_raw = [];
        var engine = "pypy" + (cfg_jit() ? "" : "-nojit");
        var results = summary["misc"]["file_size_raw"];
        for (var i = results.length - 1; i >= 0; i--) {
          data_raw.push({
            "timestamp": results[i]["timestamp"],
            "value": results[i].engines[engine].mean,
          });
        }
        var data_gz = [];
        var results = summary["misc"]["file_size_gz"];
        for (var i = results.length - 1; i >= 0; i--) {
          data_gz.push({
            "timestamp": results[i]["timestamp"],
            "value": results[i].engines[engine].mean,
          });
        }
        return [data_raw, data_gz];
      }).bind(this));
    }
  });

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
      return AWPY.fetch("data/summary.json").then((function(summary) {
        var engine = "pypy" + (cfg_jit() ? "" : "-nojit");
        var data_js = [];
        var results = summary["misc"]["load_time"];
        for (var i = results.length - 1; i >= 0; i--) {
          data_js.push({
            "timestamp": results[i]["timestamp"],
            "value": results[i].engines["js+" + engine].mean,
          });
        }
        var data_d8 = [];
        var results = summary["misc"]["load_time"];
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

  $("#config-startup-jit").on("change", function() {
    $("#config-py-jit").val($(this).val());
    $("#config-py-jit").trigger("change");
  });

  cfg_norm(AWPY.from_location_var("norm"));
  cfg_jit(AWPY.from_location_var("jit") == "on" ? true : false);

  AWPY.draw_all_the_graphs();

});
