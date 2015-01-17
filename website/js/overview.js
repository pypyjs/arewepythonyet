$(document).ready(function() {

  var summary = null;

  // The latest results of the python benchmarks, normalized to native.

  var pyBenchBreakdown = new AWPY.Graph({
    title: "Individual benchmarks",
    config: {
      norm: "python",
      jit: true
    },
    description: function() {
      desc = "Mean time for each python benchmark,";
      desc += " normalized to " + this.config.norm;
      return desc
    },
    chart_type: "bar",
    target: "#graph-py-breakdown",
    x_accessor: "value",
    y_accessor: "label",
    x_label: function() {
      return "runtime (normalized to " + this.config.norm + ")";
    },
    baseline_accessor: "baseline",
    data: function() {
      var data = [];
      var product = 1;
      BENCHMARKS: for (var b_name in summary.py.benchmarks) {
        var b_res = summary.py.benchmarks[b_name];
        var js_engines;
        if (this.config.jit) {
          js_engines = ["js+pypy", "d8+pypy"];
        } else {
          js_engines = ["js+pypy-nojit", "d8+pypy-nojit"];
        }
        if (!b_res[0].engines[this.config.norm]) continue;
        for (var i = 0; i < js_engines.length; i++) {
          if (!b_res[0].engines[js_engines[i]]) {
            continue BENCHMARKS;
          }
        }
        var b_norm = b_res[0].engines[this.config.norm].mean;
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
        txt += " times slower than " + this.config.norm;
      } else {
        txt = Math.round((1 / geo_mean) * 10) / 10;
        txt += " times faster than " + this.config.norm;
      }
      $("#compare-py-trend").text(txt);
      return data;
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
      desc += "normalized to " + this.config.norm;
      return desc
    },
    legend: function() {
      if (this.config.jit) {
        return [this.config.norm, "js+pypy", "d8+pypy"];
      } else {
        return [this.config.norm, "js+pypy-nojit", "d8+pypy-nojit"];
      }
    },
    target: "#graph-py-trend",
    legend_target: "#legend-py-trend",
    x_accessor: "timestamp",
    y_accessor: "value",
    y_label: function() {
      return "runtime (normalized to " + this.config.norm + ")";
    },
    data: function() {
      var b_means = summary.py.geometric_mean;
      var b_means_norm = {};
      for (var i = b_means.length - 1; i >= 0; i--) {
        var norm = b_means[i].engines[this.config.norm].value;
        for (var e_name in b_means[i].engines) {
          var e_means_norm = b_means_norm[e_name];
          if (!e_means_norm) {
            e_means_norm = b_means_norm[e_name] = [];
          }
          e_means_norm.push({
            timestamp: b_means[i].timestamp,
            value: b_means[i].engines[e_name].value / norm
          });
        }
      }
      return [
        b_means_norm[this.config.norm],
        b_means_norm["js+pypy" + (this.config.jit ? "" : "-nojit")],
        b_means_norm["d8+pypy" + (this.config.jit ? "" : "-nojit")]
      ]
    }
  });

  $("#config-py-norm").on("change", function() {
    var norm = $(this).val();
    if (norm == "pypy" && $("#config-py-jit").val() === "off") {
      norm = "pypy-nojit";
    }
    pyBenchBreakdown.config.norm = norm;
    pyBenchMeanTrend.config.norm = norm;
    if (summary) {
      pyBenchBreakdown.draw();
      pyBenchMeanTrend.draw();
    }
  });
  $("#config-py-norm").trigger("change");

  $("#config-py-jit").on("change", function() {
    var jit = $(this).val() === "on";
    pyBenchBreakdown.config.jit = jit;
    pyBenchMeanTrend.config.jit = jit;
    $("#config-py-norm").trigger("change");
  });
  $("#config-py-jit").trigger("change");


  var miscDownloadSize = new AWPY.Graph({
    title: "Download Size",
    description: "Total size of all core interpreter files, over time",
    config: {
      jit: true
    },
    target: "#graph-file-size",
    x_accessor: "timestamp",
    y_accessor: "value",
    y_label: "download size (bytes)",
    legend: ["raw", "gz"],
    legend_target: "#legend-file-size",
    data: function() {
      var data_raw = [];
      var engine = "pypy" + (this.config.jit ? "" : "-nojit");
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
    }
  });

  var miscLoadTime = new AWPY.Graph({
    title: "Load Time",
    description: "Time to load and initialize the core interpreter, over time",
    config: {
      jit: true
    },
    target: "#graph-load-time",
    legend: ["js+pypy", "d8+pypy"],
    legend_target: "#legend-load-time",
    x_accessor: "timestamp",
    y_accessor: "value",
    y_label: "load time (seconds)",
    data: function() {
      var engine = "pypy" + (this.config.jit ? "" : "-nojit");
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
    }
  });

  $("#config-startup-jit").on("change", function() {
    var jit = $(this).val() === "on";
    miscDownloadSize.config.jit = jit;
    miscLoadTime.config.jit = jit;
    if (summary) {
      miscDownloadSize.draw();
      miscLoadTime.draw();
    }
  });
  $("#config-startup-jit").trigger("change");

  function redrawAllTheGraphs() {
    if (!summary) return;
    pyBenchBreakdown.draw();
    pyBenchMeanTrend.draw();
    miscDownloadSize.draw();
    miscLoadTime.draw();
  }

  d3.json("/data/summary.json", function(data) {
    AWPY.convert_timestamps(data);
    summary = data;
    redrawAllTheGraphs();
  });

  $(window).on('resize', function() {
    redrawAllTheGraphs();
  });

});
