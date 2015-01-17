var AWPY = {};

AWPY.Graph = function Graph(options) {
  this.options = options;
  this.config = options.config || {};
  delete options.config;
};


AWPY.Graph.prototype.draw = function() {
  var opts = {};
  for (var k in this.options) {
    if (typeof this.options[k] === "function") {
      opts[k] = this.options[k].call(this);
    } else {
      opts[k] = this.options[k];
    }
  }
  if (!opts.width) {
    opts.width = $(opts.target).width();
  }
  if (!opts.height) {
    opts.height = 250;
  }
  // Re-rendering bar charts doesn't seem to work quite right.
  // This forces it to re-draw from scratch.
  if (opts.chart_type === "bar") {
    $(opts.target).empty();
  }
  MG.data_graphic(opts);
}


AWPY.convert_timestamps = function convert_timestamps(data) {
  for (var k in data) {
    if (data[k] instanceof Array) {
      MG.convert.date(data[k], "timestamp", "%Y%m%d%H%M%S");
    } else if (data[k] instanceof Object) {
      convert_timestamps(data[k]);
    }
  }
}
