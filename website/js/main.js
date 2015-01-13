$(document).ready(function() {

  var bench_summary = null;

  d3.json("/data/summary.json", function(data) {

    bench_summary = data;

    MG.data_graphic({
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

    MG.data_graphic({
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

    MG.data_graphic({
      title: "Performance Now",
      data: [
        {date: new Date('2015-01-10'), value: 6},
        {date: new Date('2016-01-10'), value: 7}
      ],
      target: "#graph-py-bars",
      width: $("#graph-py-bars").width(),
      x_accessor: "date",
      y_accessor: "value"
    });

    MG.data_graphic({
      title: "Performance over time",
      data: [
        {date: new Date('2015-01-10'), value: 6},
        {date: new Date('2016-01-10'), value: 7}
      ],
      target: "#graph-py-line",
      x_accessor: "date",
      y_accessor: "value"
    });

  });


});
