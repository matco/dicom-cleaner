import Dictionaries from '../dictionaries.js';
import DICOM from '../dicom.js';

const Actions = {
	Analyse: 'analyse',
	Clean: 'clean'
};

let current_dicom;
let current_tags;

self.addEventListener('message', function(message) {
	const data = message.data;
	console.info('Receiving message from application', data);

	const action = data.action;
	if(action) {
		switch(action) {
			case Actions.Analyse:
				current_dicom = data.dicom;
				analyse(current_dicom);
				break;
			case Actions.Clean: {
				if(current_dicom) {
					const tags = data.tags;
					clean(current_dicom, tags);
				}
				else {
					self.postMessage({error: 'Load a DICOM file first'});
				}
				break;
			}
		}
	}
});

function analyse(dicom) {
	self.postMessage({action: Actions.Analyse, begin: true, message: 'Beginning analysis'});
	//check DICOM prefix
	if(!DICOM.IsValid(dicom)) {
		self.postMessage({action: Actions.Analyse, error: 'Not a DICOM file'});
		return;
	}
	current_tags = DICOM.ParseTags(
		dicom,
		function(tag) {
			if(tag.data.length > 0) {
				const tag_definition = Dictionaries.Tags.find(t => t.id === tag.id);
				//send only tags with a definition
				if(tag_definition) {
					const tag_type_definition = Dictionaries.TagTypes[tag.type];
					//send only tags with a type definition and that are not raw
					if(tag_type_definition && tag_type_definition.type !== 'RAW') {
						tag.rawvalue = tag_type_definition.extract(dicom, tag.data.offset, tag.data.length);
						tag.value = tag_type_definition.format(tag_type_definition.parse(tag.rawvalue));
						self.postMessage({action: Actions.Analyse, tag: tag, message: 'Tag found'});
					}
				}
			}
		},
		{analyse_raw: true}
	);
	self.postMessage({action: Actions.Analyse, end: true, result: current_tags, message: 'End of analysis'});
}

function clean(dicom, tags) {
	self.postMessage({action: Actions.Clean, begin: true, message: 'Beginning to clean'});
	const buffer = DICOM.CleanTags(dicom, current_tags, tags);
	self.postMessage({action: Actions.Clean, end: true, result: buffer, message: 'Tag cleaned'}, [buffer]);
}
