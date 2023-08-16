import '@matco/basic-tools/extension.js';
import '@matco/basic-tools/dom_extension.js';

import Dictionaries from '../src/dictionaries.js';
import Analyser from '../src/workers/analyser.js';

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
	clean_tag(this.parentNode.parentNode.parentNode.id);
}

function draw_tag(tag) {
	const instance = document.importNode(document.getElementById('tag').content, true);
	const tag_line = instance.querySelector('tr');
	tag_line.setAttribute('id', tag.id);
	instance.querySelector('slot[name="id"]').textContent = tag.id;
	const tag_definition = Dictionaries.Tags.find(t => t.id === tag.id);
	instance.querySelector('slot[name="name"]').textContent = tag_definition.name;
	instance.querySelector('slot[name="raw-value"]').textContent = tag.rawvalue;
	instance.querySelector('slot[name="value"]').textContent = tag.value;
	instance.querySelector('slot[name="type"]').textContent = tag.type;
	instance.querySelector('slot[name="length"]').textContent = tag.data.length;
	if(tag_definition.sensitive) {
		const clean_button = document.createFullElement('button', {}, 'Clear');
		clean_button.addEventListener('click', clean_listener);
		instance.querySelector('slot[name="action"]').appendChild(clean_button);
	}
	return instance;
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
	stop_loading();
	document.getElementById('error').textContent = 'Error while loading file';
}

function init() {
	//build analyser worker
	const analyser = new Analyser({type: 'module'});
	analyser.addEventListener('message', function(message) {
		const data = message.data;
		console.info('Receiving message from analyser', data);
		if(data.error) {
			stop_loading();
			document.getElementById('error').textContent = data.error;
		}
		else {
			switch(data.action) {
				case 'clean': {
					if(data.end) {
						const blob = new Blob([new Uint8Array(data.result)]);
						const file = new File([blob], current_filename, {type: DICOM_MIME_TYPE, lastModified: Date.now()});
						const url = window.URL.createObjectURL(file);
						//Chrome does not support to set location href
						if(/Chrome/.test(navigator.userAgent)) {
							const link = document.createFullElement('a', {href: url, download: current_filename});
							const event = new MouseEvent('click', {view: window, bubbles: true, cancelable: true});
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
						start_loading('Analyzing file');
					}
					else if(message.data.end) {
						stop_loading();
					}
					else if(data.tag) {
						const tag = message.data.tag;
						document.querySelector('#tags').appendChild(draw_tag(tag));
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

		document.querySelector('#tags').empty('tr');
		analyser.postMessage({action: 'analyse', dicom: dicom}, [dicom]);

		document.getElementById('download').setAttribute('title', 'Clean a tag to download an updated version of the DICOM file');
		document.getElementById('download').setAttribute('disabled', 'disabled');
		document.querySelector('content').style.display = 'block';
	}

	document.getElementById('file').addEventListener(
		'submit',
		function(event) {
			document.getElementById('error').textContent = '';
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
				function() {
					if(xhr.status === 200) {
						const filename = url.pathname.substring(url.pathname.lastIndexOf('/') + 1);
						console.log(`Read file ${filename}`);
						document.getElementById('filename').textContent = filename;
						read_dicom(xhr.response, filename);
					}
					else {
						stop_loading();
						document.getElementById('error').textContent = 'Unable to fetch file';
					}
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
							read_dicom(buffer, filename);
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
			analyser.postMessage({action: 'clean', tags: tags_to_clean});
		}
	);

	//eslint-disable-next-line no-unused-vars
	function test() {
		const form = document.getElementById('file');
		const location = window.location;
		form['url'].value = `${location.protocol}//${location.hostname}:${location.port}/test/sample1.dcm`;

		//submit form
		const submit = new SubmitEvent('submit', {view: window, bubbles: true, cancelable: true});
		form.dispatchEvent(submit);
	}
	//setTimeout(test, 100);
}

window.addEventListener('load', init);
