$(document).ready(function() {

  var bench_summary = null;

  function my_data_graphic(opts) {
    if (!opts.width) {
      opts.width = $(opts.target).width();
    }
    if (!opts.height) {
      opts.height = 250;
    }
    return MG.data_graphic(opts);
  }

  function redrawAllTheGraphs() {

    if (!bench_summary) return;

    my_data_graphic({
      title: "Current benchmarks",
      description: "Time for each benchmark, normalized to cpython",
      chart_type: "bar",
      data: [
        {label: "chaos", value: 0.9, baseline: 1},
        {label: "fannkuch", value: 1.5, baseline: 1},
        {label: "float", value: 0.12, baseline: 1},
        {label: "meteor-contest", value: 0.9, baseline: 1},
        {label: "nbody_modified", value: 0.9, baseline: 1},
        {label: "nqueens", value: 1.5, baseline: 1},
        {label: "richards", value: 0.12, baseline: 1},
        {label: "spectral-norm", value: 0.12, baseline: 1}
      ],
      target: "#graph-py-bars",
      x_accessor: "value",
      y_accessor: "label",
      baseline_accessor: "baseline"
    });

    my_data_graphic({
      title: "Performance over time",
      description: "Mean time across all benchmarks, normalized to cpython, over time",
      data: [
        [
          {date: new Date('2015-01-10'), value: 1},
          {date: new Date('2016-01-10'), value: 1}
        ],
        [
          {date: new Date('2015-01-10'), value: 0.9},
          {date: new Date('2016-01-10'), value: 1.1}
        ],
        [
          {date: new Date('2015-01-10'), value: 0.8},
          {date: new Date('2016-01-10'), value: 0.7}
        ]
      ],
      x_accessor: "date",
      legend: ["cpython", "js+pypy", "d8+pypy"],
      legend_target: "#legend",
      target: "#graph-py-line",
      y_accessor: "value"
    });

    my_data_graphic({
      title: "Download Size",
      description: "Total size of all core interpreter files",
      data: [
        {date: new Date('2015-01-10'), value: 14000000},
        {date: new Date('2016-01-10'), value: 13000000}
      ],
      target: "#graph-file-size",
      x_accessor: "date",
      y_accessor: "value"
    });

    my_data_graphic({
      title: "Load Time",
      description: "Time to load and initialize the core interpreter",
      data: [
        {date: new Date('2015-01-10'), value: 6},
        {date: new Date('2016-01-10'), value: 7}
      ],
      target: "#graph-load-time",
      x_accessor: "date",
      y_accessor: "value"
    });

    my_data_graphic({
      title: "PyStone",
      description: "Total size of all core interpreter files",
      data: [
        {date: new Date('2015-01-10'), value: 14000000},
        {date: new Date('2016-01-10'), value: 13000000}
      ],
      target: "#graph-pystone-mean",
      x_accessor: "date",
      y_accessor: "value"
    });

    my_data_graphic({
      title: "PyStone Warmup",
      description: "Time to load and initialize the core interpreter",
      data: [
        {date: new Date('2015-01-10'), value: 6},
        {date: new Date('2016-01-10'), value: 7}
      ],
      target: "#graph-pystone-seq",
      x_accessor: "date",
      y_accessor: "value"
    });

  }

  d3.json("/data/summary.json", function(data) {
    bench_summary = data;
    redrawAllTheGraphs();
  });

  $(window).on('resize', function() {
    redrawAllTheGraphs();
  });

});
