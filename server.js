import fs from 'fs';
import path from 'path';
import http from 'http';
import node_static from 'node-static';

const PORT = process.env.PORT || 1338;

const file_server = new node_static.Server('./www');

//create http server
http.createServer(function(request, response) {
	//mount test resources
	if(request.url.startsWith('/test/sample')) {
		const sample_filename = request.url.slice(request.url.lastIndexOf('/') + 1);
		const sample_path = path.join('test', 'resources', sample_filename);
		if(fs.lstatSync(path.join(__dirname, sample_path)).isFile()) {
			file_server.serveFile(path.join('..', sample_path), 200, {}, request, response);
		}
		else {
			response.statusCode = 404;
			response.end();
		}
	}
	else {
		request.addListener('end', function() {
			file_server.serve(request, response);
		}).resume();
	}
}).listen(PORT);
