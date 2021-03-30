import Dictionaries from './dictionaries.js';

//parse dataset
const DataElements = {
	Item : Dictionaries.Helpers.TagToIntegerArray('(FFFE,E000)'),
	DelimitationItem : Dictionaries.Helpers.TagToIntegerArray('(FFFE,E00D)'),
	SequenceDelimitationItem : Dictionaries.Helpers.TagToIntegerArray('(FFFE,E0DD)')
};

function array_equals(array_1, array_2) {
	if(array_1.length !== array_2.length) {
		return false;
	}
	for(let i = array_1.length - 1; i >= 0; i--) {
		if(array_1[i] !== array_2[i]) {
			return false;
		}
	}
	return true;
}

function offsetize(integer) {
	return `0x${integer.toString(16).toUpperCase()}`;
}

function retrieve_items(buffer, start, stop) {
	console.log(`Looking for items in ${stop - start} bytes`);
	const dataview = new DataView(buffer);
	const items = [];
	const values_window = [];
	let last_bookmark = start;
	for(let i = start; i < stop; i++) {
		const current_value = dataview.getUint8(i);
		if(values_window.length === 4) {
			values_window.shift();
		}
		values_window.push(current_value);
		if(array_equals(values_window, DataElements.Item)) {
			//add ending item
			const item = {start : last_bookmark, stop : i - 3};
			//separator can be found at the beginning of the buffer
			if(item.stop - item.start > 0) {
				console.log(`Found item from ${offsetize(item.start)} to ${offsetize(item.stop)}`);
				items.push(item);
			}
			last_bookmark = i + 1;
		}
	}
	return items;
}

//parse data view to find tag values
export default {
	IsValid : function(dicom) {
		//check prefix
		const prefix = String.fromCodePoint(...new Uint8Array(dicom, 128, 4));
		return prefix === 'DICM';
	},
	CleanTags : function(dicom, current_tags, tags) {
		const buffer = dicom.slice();
		//remove tags to clear from current dicom
		tags.forEach(function(tag_id) {
			const tag = current_tags.find(t => t.id === tag_id);
			//do not clean if tag does not exist in the file
			if(tag && tag.data.length) {
				const tag_definition = Dictionaries.Tags.find(t => t.id === tag_id);
				tag_definition.clean(buffer, tag.offset, tag.data.offset, tag.data.length);
			}
		});
		return buffer;
	},
	ParseTags : function(dicom, ontag, options) {
		console.log(`Looking for tags in ${dicom.byteLength} bytes`);
		const dataview = new DataView(dicom);
		const tags = [];
		//do not analyse first 131 bytes
		let offset = 132;
		while(offset < dicom.byteLength) {
			//build tag object
			const tag = {
				offset : offset,
				data : {}
			};
			//take first pack of 4 bytes
			const id = [dataview.getUint8(offset), dataview.getUint8(offset + 1), dataview.getUint8(offset + 2), dataview.getUint8(offset + 3)];
			tag.id = Dictionaries.Helpers.IntegerArrayToTag(id);
			console.log(`Found tag ${tag.id} at offset ${offsetize(offset)}`);
			//find tag definition
			const tag_definition = Dictionaries.Tags.find(t => array_equals(id, t.values));
			if(!tag_definition) {
				console.error(`Unknown tag id ${tag.id}`);
			}
			//find tag type
			tag.type = String.fromCodePoint(dataview.getUint8(offset + 4), dataview.getUint8(offset + 5));
			const tag_type_definition = Dictionaries.TagTypes[tag.type];
			//check that type matches an existing tag and tag definition allows this type
			if(!tag_type_definition) {
				console.error(`Unknown tag type ${tag.type}`);
			}
			//check tag type against tag definition
			if(tag_definition && !tag_definition.type.includes(tag.type)) {
				console.error(`Inconsistent tag type: expected ${tag_definition.type.join(',')}, actual ${tag.type}`);
			}
			//find tag offset and tag length
			if(['OB', 'OW', 'SQ'].includes(tag.type)) {
				//first two bytes must be 0
				if(dataview.getUint8(offset + 6) !== 0 || dataview.getUint8(offset + 7) !== 0) {
					console.error('First 2 bytes after type must be set to 0');
				}
				tag.data.offset = offset + 12;
				//get tag length (little endian)
				tag.data.length = dataview.getUint32(offset + 8, true);
				//all length bytes set to FF means that data lasts until end of file
				if(tag.data.length === 4294967295) {
					console.log('Tag value lasts until end of file');
					tag.data.length = dicom.byteLength - tag.data.offset;
					//retrieve items in raw element only if asked to do so
					if(options && options.analyse_raw) {
						tag.data.items = retrieve_items(dicom, tag.data.offset, tag.data.offset + tag.data.length);
					}
				}
			}
			else {
				tag.data.offset = offset + 8;
				//get tag length (little endian)
				tag.data.length = dataview.getUint16(offset + 6, true);
			}
			console.info(`Tag data starts at ${offsetize(tag.data.offset)} with a length of ${tag.data.length}`);
			tags.push(tag);
			if(ontag) {
				ontag.call(undefined, tag);
			}
			//move forward at the end of tag data
			offset = Math.min(dicom.byteLength, tag.data.offset + tag.data.length);
			console.log(`Jump to 0x${offset.toString(16)}`);
		}
		return tags;
	}
};
