$(document).ready(function() {

  var cfg_jit = new AWPY.ConfigOption("jit", {
    default: "on"
  });
  cfg_jit.add_widget("#config-filesize-jit");
  cfg_jit.add_widget("#config-loadtime-jit");
  cfg_jit.add_widget("#config-local-jit");

  function cfg_js_engines() {
    if (cfg_jit.value === "on") {
      js_engines = ["js+pypy", "d8+pypy"];
    } else {
      js_engines = ["js+pypy-nojit", "d8+pypy-nojit"];
    }
    return js_engines;
  }

  var miscDownloadSize = new AWPY.Graph({
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

  var miscLoadTime = new AWPY.Graph({
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

  AWPY.draw_all_the_graphs();

});
