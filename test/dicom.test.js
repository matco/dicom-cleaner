/* global describe, it */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import url from 'url';

import DICOM from '../www/dicom.js';
import Dictionaries from '../www/dictionaries.js';

const module_url = new URL(import.meta.url);

function read_test_file(filename) {
	const filepath = path.resolve(path.dirname(url.fileURLToPath(module_url)), 'resources', filename);
	return fs.readFileSync(filepath).buffer;
}

function filter_interesting_tags(tag) {
	if(tag.data.length > 0) {
		const tag_definition = Dictionaries.Tags.find(t => t.id === tag.id);
		if(tag_definition) {
			const tag_type_definition = Dictionaries.TagTypes[tag.type];
			return tag_type_definition && tag_type_definition.type !== 'RAW';
		}
	}
	return false;
}

describe('DICOM', function() {
	describe('#isValid()', function() {
		it('should be valid when "DCM" is present at offset 128', function() {
			const buffer = new ArrayBuffer(150);
			assert.ok(!DICOM.IsValid(buffer));
			//add DICOM marker in buffer
			const marker = 'DICM';
			const marker_offset = 128;
			const data = new Uint8Array(buffer);
			for(let i = 0; i < marker.length; i++) {
				data.fill(marker.charCodeAt(i), marker_offset + i, marker_offset + i + 1);
			}
			assert.ok(DICOM.IsValid(buffer));
		});
		it('should be valid for sample DICOM files', function() {
			assert.ok(DICOM.IsValid(read_test_file('sample1.dcm')));
			assert.ok(DICOM.IsValid(read_test_file('sample2.dcm')));
		});
	});
	describe('#parseTags()', function() {
		it('should parse tags properly', function() {
			const dicom = read_test_file('sample1.dcm');
			const tags = DICOM.ParseTags(dicom);

			//check number of tags found
			assert.equal(tags.length, 62);
			assert.equal(tags.filter(filter_interesting_tags).length, 46);

			//check first tag
			let tag = tags.find(t => t.id === '(0002,0000)');
			assert.equal(`0x${tag.offset.toString(16).toUpperCase()}`, '0x84');
			assert.equal(tag.data.length, 4);
			let tag_type_definition = Dictionaries.TagTypes[tag.type];
			let raw_value = tag_type_definition.extract(dicom, tag.data.offset, tag.data.length);
			assert.equal(raw_value, 158);

			//check special tag
			tag = tags.find(t => t.id === '(0010,0010)');
			assert.equal(`0x${tag.offset.toString(16).toUpperCase()}`, '0x2E2');
			assert.equal(tag.data.length, 40);
			tag_type_definition = Dictionaries.TagTypes[tag.type];
			raw_value = tag_type_definition.extract(dicom, tag.data.offset, tag.data.length);
			assert.equal(raw_value, 'Femoral trombenarterectomy^Case Report: ');
		});
	});
	describe('#cleanTags()', function() {
		it('should clean tags properly', function() {
			const dicom = read_test_file('sample1.dcm');
			const tags = DICOM.ParseTags(dicom);

			const tag = tags.find(t => t.id === '(0010,0010)');
			const anonymized_dicom = DICOM.CleanTags(dicom, tags, ['(0010,0010)']);

			assert.equal(dicom.byteLength, anonymized_dicom.byteLength);

			const dataview = new DataView(dicom);
			const anonymized_dataview = new DataView(dicom);

			const content = 'Anonymized'.padEnd(tag.data.length, ' ');
			for(let i = tag.data.offset; i <= tag.data.length; i++) {
				assert.equal(anonymized_dataview.getUint8(i), content.charCodeAt(i - tag.data.offset));
			}
			for(let i = 0; i < dicom.byteLength; i++) {
				if(i < tag.data.offset || i > tag.data.offset + tag.data.length) {
					assert.equal(dataview.getUint8(i), anonymized_dataview.getUint8(i));
				}
			}
		});
	});
});
