var AWPY = {};

AWPY.data_promises = {};

AWPY.fetch = function(name) {
  if (!name) {
    return Promise.resolve();
  }
  if (!AWPY.data_promises[name]) {
    AWPY.data_promises[name] = new Promise(function(resolve, reject) {
      d3.json(name, function(data) {
        if (data) {
          AWPY.convert_timestamps(data);
          resolve(data);
        } else {
          reject("failed to fetch " + name);
        }
      });
    });
  }
  return AWPY.data_promises[name];
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


AWPY.all_graphs = [];

AWPY.draw_all_the_graphs = function draw_all_the_graphs() {
  var p = Promise.resolve();
  for (var i = 0; i < AWPY.all_graphs.length; i++) {
    p = p.then((function(i) { return function() {
      return AWPY.all_graphs[i].draw();
    };})(i));
  }
}


AWPY.from_location_var = function from_location_var(name) {
  var r = new RegExp("(#|&)" + name + "=([a-zA-Z0-9_\\-\\+]+)($|&)");
  var match = r.exec(window.location.hash);
  return match ? match[2] : undefined;
}


AWPY.to_location_var = function to_location_var(name, value) {
  var r = new RegExp("(#|&)" + name + "=([a-zA-Z0-9_\\-\\+]+)($|&)");
  var hash = window.location.hash;
  var match = r.exec(hash);
  if (!match) {
    if (hash && hash !== "#") {
      window.location.hash += "&" + name + "=" + value;
    } else {
      window.location.hash = "#" + name + "=" + value;
    }
  } else {
    var prefix = hash.substr(0, match.index + 1);
    var suffix = hash.substr(match.index + match[0].length - match[3].length);
    window.location.hash = prefix + name + "=" + value + suffix;
  }
}


AWPY.Graph = function Graph(options) {
  this.options = options;
  AWPY.all_graphs.push(this);
};


AWPY.Graph.prototype.draw = function() {
  var opts = {};
  // Gather all the graph options.
  // Any functions return promises that we need to resolve async.
  var p = Promise.resolve();
  for (var k in this.options) {
    if (typeof this.options[k] !== "function") {
      opts[k] = this.options[k];
    } else {
      p = p.then((function(k) { return (function() {
        return this.options[k].call(this);
      }).bind(this);}).bind(this)(k))
      .then((function(k) { return function(val) {
        opts[k] = val;
      };})(k));
    }
  }
  return p.then((function() {
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
  }).bind(this));
}

$(document).ready(function() {

  $(window).on('resize', function() {
    AWPY.draw_all_the_graphs();
  });

});
