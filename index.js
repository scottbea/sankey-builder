var _ = require('underscore');
var fs = require('fs');
var httpServer = require('http-server');



function listen(host, port) {
  var options = {};
  var server = httpServer.createServer(options);
  server.listen(port, host, function() {
     console.log("Server web page at: http://localhost:8080\nHit Ctrl-C to exit\n");
  });
}




exports.cli = function() {
	// get the parameters
	var filename = process.argv[2];
	var outputFilename = process.argv[3];

	// Check paramters and usage
	if (process.argv.length <= 2) {
		console.log("\nUsage: sankey-panky <filename> [<output_filename>]\n\n");
		process.exit(1);
	}

	var output = exports.compileTsvToSankeyJson(filename, outputFilename);

	if (outputFilename) { 
		console.log("\n'%s' was compiled successfully to '%s'\n\n", filename, outputFilename);
	}
	else {
		listen('127.0.0.1', 8080);
	}
};



exports.compileTsvToSankeyJson = function(filename, outputFilename) {
	var buffer;

	var lines = _.compact(fs.readFileSync(filename, 'utf-8').split('\n'));
	var links = _.map(lines, function (line, i) { return line.split('\t'); });
	var nodes = _.invert(_.uniq(_.union(_.pluck(links, 0), _.pluck(links, 1))));

	var ds = {"nodes": [], "links": []};
	ds.nodes = _.map(nodes, function (i, node) { return {"node": parseInt(i), "name": node}; });
	ds.links = _.map(links, function (link) {
		return {"source": parseInt(nodes[link[0]]), "target": parseInt(nodes[link[1]]), "value": parseFloat(link[2]) };
	});
	ds.links = _.map(links, function (link) {
		var sourceName = link[0];
		var targetName = link[1];
		var weight = link[2].trim();
		var weightScore = (weight === "*") ? Number.NaN : parseFloat(weight);
		var source = parseInt(nodes[link[0]]);
		var target = parseInt(nodes[link[1]]);
		return {"source": source, "target": target, "value": weightScore };
	});

	var nodeIncoming = {};
	var nodeIncomingMissing = {};
	var nodeIncomingCount = {};
	_.each(nodes, function (i) {
		var x = parseInt(i);
		var sum = 0;
		var missing = 0;
		var count = 0;
		_.each(ds.links, function (link) {
			if (link.target === x) {
				count++;
				if (_.isNaN(link.value)) {
					missing += 1;
				}
				else {
					sum += link.value;
				}
			}
		});
		nodeIncomingCount[x] = count;
		nodeIncomingMissing[x] = missing;
		nodeIncoming[x] = sum;
	});


	var nodeOutgoing = {};
	var nodeOutgoingMissing = {};
	var nodeOutgoingCount = {};
	_.each(nodes, function (i) {
		var x = parseInt(i);
		var sum = 0;
		var missing = 0;
		var count = 0;
		_.each(ds.links, function (link) {
			if (link.source === x) {
				count++;
				if (_.isNaN(link.value)) {
					missing += 1;
				}
				else {
					sum += link.value;
				}
			}
		});
		nodeOutgoingCount[x] = count;
		nodeOutgoingMissing[x] = missing;
		nodeOutgoing[x] = sum;
	});


	_.each(ds.links, function (link) {
		if (_.isNaN(link.value)) {
			var x = link.source;
			link.value = ((nodeIncoming[x] - nodeOutgoing[x]) / (nodeIncomingMissing[x] || 1) );
		}
	});

	buffer = JSON.stringify(ds);

	if (_.isString(outputFilename)) { fs.writeFileSync(outputFilename, buffer); }
	else { fs.writeFileSync("data.json", buffer); }

	return buffer;
};
