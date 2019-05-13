import Dictionaries from '../dictionaries.js';

const DICOM_MIME_TYPE = 'application/dicom';

let current_filename;
const tags_to_clean = [];

function clean_tag(tag_id) {
	//save tag in list of tags to clean
	tags_to_clean.push(tag_id);
	//blur associated lines and display download button
	const tag_line = document.getElementById(tag_id);
	if(tag_line) {
		tag_line.querySelectorAll('td[data-value]').forEach(t => t.classList.add('cleared'));
		tag_line.querySelector('button').setAttribute('disabled', 'disabled');
		document.getElementById('download').removeAttribute('title');
		document.getElementById('download').removeAttribute('disabled');
	}
}

function clean_listener() {
	clean_tag(this.parentNode.parentNode.id);
}

function draw_tag(tag) {
	const tag_line = document.createFullElement('tr', {id : tag.id});
	tag_line.appendChild(document.createFullElement('td', {}, tag.id));
	const tag_definition = Dictionaries.Tags.find(t => t.id === tag.id);
	tag_line.appendChild(document.createFullElement('td', {}, tag_definition.name));
	tag_line.appendChild(document.createFullElement('td', {'data-value' : 'true'}, tag.rawvalue));
	tag_line.appendChild(document.createFullElement('td', {'data-value' : 'true'}, tag.value));
	tag_line.appendChild(document.createFullElement('td', {}, tag.type));
	tag_line.appendChild(document.createFullElement('td', {}, tag.data.length));
	const button_cell = document.createElement('td');
	tag_line.appendChild(button_cell);
	if(tag_definition.sensitive) {
		const clean_button = document.createFullElement('button', {}, 'Clear');
		clean_button.addEventListener('click', clean_listener);
		button_cell.appendChild(clean_button);
	}
	return tag_line;
}

function start_loading(message) {
	const loading = document.getElementById('loading');
	loading.textContent = message || 'Loading';
	loading.style.backgroundImage = '';
}

function stop_loading() {
	document.getElementById('loading').textContent = '';
}

function progress_loading(event) {
	if(event.lengthComputable) {
		const percent = Math.round((event.loaded / event.total) * 100);
		document.getElementById('loading').style.backgroundImage = `linear-gradient(to right, #b8daff ${percent}%, #cce5ff ${percent}%)`;
	}
}

function error_loading() {
	document.getElementById('error').textContent = 'Error while loading file';
}

function init() {
	//build analyser worker
	const analyser = new Worker('workers/analyser.js', {type : 'module'});
	analyser.addEventListener('message', function(message) {
		const data = message.data;
		console.info('Receiving message from analyser', data);
		if(data.error) {
			document.getElementById('error').textContent = data.error;
		}
		else {
			switch(data.action) {
				case 'clean': {
					if(data.end) {
						const blob = new Blob([new Uint8Array(data.result)]);
						console.log(current_filename);
						const file = new File([blob], current_filename, {type: DICOM_MIME_TYPE, lastModified: Date.now()});
						const url = window.URL.createObjectURL(file);
						//Chrome does not support to set location href
						if(/Chrome/.test(navigator.userAgent)) {
							const link = document.createFullElement('a', {href: url, download: current_filename});
							const event = document.createEvent('MouseEvents');
							event.initUIEvent('click', true, true, window, 1);
							link.dispatchEvent(event);
						}
						else {
							location.href = url;
						}
						//revoke url after event has been dispatched
						setTimeout(function() {
							window.URL.revokeObjectURL(url);
						}, 0);
					}
					break;
				}
				case 'analyse': {
					if(message.data.begin) {
						start_loading('Analysing file');
					}
					else if(message.data.end) {
						stop_loading();
					}
					else if(data.tag) {
						const tag = message.data.tag;
						document.querySelector('#tags tbody').appendChild(draw_tag(tag));
					}
					break;
				}
			}
		}
	});

	function read_dicom(dicom, filename) {
		//reset previous tags to clean
		tags_to_clean.length = 0;

		//save dicom as current dicom
		current_filename = filename;

		document.querySelector('#tags tbody').clear();
		analyser.postMessage({action : 'analyse', dicom : dicom}, [dicom]);

		document.getElementById('download').setAttribute('title', 'Clean a tag to download an updated version of the DICOM file');
		document.getElementById('download').setAttribute('disabled', 'disabled');
		document.querySelector('content').style.display = 'block';
	}

	document.getElementById('file').addEventListener(
		'submit',
		function(event) {
			event.stopPropagation();
			event.preventDefault();
			const url = new URL(this['url'].value);
			//do not use fetch API to be able to do something as soon as first bytes are read
			const xhr = new XMLHttpRequest();
			xhr.addEventListener('loadstart', start_loading.bind(undefined, 'Fetching file'));
			xhr.addEventListener('loadend', stop_loading);
			xhr.addEventListener('progress', progress_loading);
			xhr.addEventListener('error', error_loading);
			xhr.addEventListener(
				'load',
				function(xhr_event) {
					const filename = url.pathname.substring(url.pathname.lastIndexOf('/') + 1);
					console.log(`Read file ${filename}`);
					document.getElementById('filename').textContent = filename;
					read_dicom(xhr_event.target.response, filename);
				}
			);
			xhr.open('GET', url.href, true);
			xhr.responseType = 'arraybuffer';
			xhr.send();
		}
	);

	//handle drag and drop
	document.body.addEventListener(
		'dragover',
		function(event) {
			event.preventDefault();
			if(event.dataTransfer.types.includes(DICOM_MIME_TYPE)) {
				event.dataTransfer.dropEffect = 'link';
				this.classList.add('dragover');
			}
		}
	);

	document.body.addEventListener(
		'dragleave',
		function() {
			this.classList.remove('dragover');
		}
	);

	document.body.addEventListener(
		'drop',
		function(event) {
			event.preventDefault();
			const error = document.getElementById('error');
			error.textContent = '';
			this.classList.remove('dragover');
			//only one file can be managed at a time
			if(event.dataTransfer.files.length > 1) {
				error.textContent = 'Drop only one file';
			}
			else {
				const file = event.dataTransfer.files[0];
				if(file.type !== '' && file.type !== DICOM_MIME_TYPE) {
					error.textContent = 'File must be a DICOM file';
				}
				else {
					const reader = new FileReader();
					reader.addEventListener('loadstart', start_loading.bind(undefined, 'Reading file'));
					reader.addEventListener('loadend', stop_loading);
					reader.addEventListener('progress', progress_loading);
					reader.addEventListener('error', error_loading);
					reader.addEventListener(
						'load',
						function(reader_event) {
							const filename = file.name;
							console.log(`Read file ${filename}`);
							document.getElementById('filename').textContent = filename;
							const buffer = reader_event.target.result;
							read_dicom(buffer);
						}
					);
					reader.readAsArrayBuffer(file);
				}
			}
		}
	);

	document.getElementById('clear_all').addEventListener(
		'click',
		function() {
			Dictionaries.Tags.filter(t => t.sensitive).map(t => t.id).forEach(clean_tag);
		}
	);

	document.getElementById('download').addEventListener(
		'click',
		function() {
			analyser.postMessage({action : 'clean', tags : tags_to_clean});
		}
	);

	function test() {
		const form = document.getElementById('file');
		const location = window.location;
		form['url'].value = `${location.protocol}//${location.hostname}:${location.port}/test/sample1.dcm`;

		//submit form
		const submit = document.createEvent('Event');
		submit.initEvent('submit', true, true);
		form.dispatchEvent(submit);
	}
	//setTimeout(test, 100);
}

window.addEventListener('load', init);
