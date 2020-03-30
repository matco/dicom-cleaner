/*eslint-env node, mocha*/

import assert from 'assert';

import Dictionaries from '../www/dictionaries.js';

function build_buffer_form_bytes(bytes) {
	return new Uint8Array(bytes.map(h => parseInt(h, 16))).buffer;
}

function build_buffer_form_string(string) {
	return new Uint8Array(string.split('').map(c => c.charCodeAt(0))).buffer;
}

describe('TagTypes', function() {
	describe('AS', function() {
		it('should extract data from buffer and format value properly', function() {
			const as = Dictionaries.TagTypes['AS'];
			const data = build_buffer_form_string('018M');
			const value = as.extract(data);
			assert.equal('018M', value);
			assert.equal(as.format(value), '18 month(s) ago');
		});
	});
	describe('DA', function() {
		it('should extract data from buffer and format value properly', function() {
			const da = Dictionaries.TagTypes['DA'];
			const data = build_buffer_form_string('19930822');
			const value = da.extract(data);
			const date = da.parse(value);
			assert.deepStrictEqual(new Date(Date.UTC(1993, 7, 22)), date);
			assert.equal(da.format(date), '1993-08-22');
		});
	});
	describe('DT', function() {
		it('should extract data from buffer and format value properly', function() {
			const dt = Dictionaries.TagTypes['DT'];
			const data = build_buffer_form_string('195308');
			const value = dt.extract(data);
			assert.equal('195308', value);
			assert.equal(dt.format(value), '195308');
		});
	});
	describe('TM', function() {
		it('should extract data from buffer and format value properly', function() {
			const tm = Dictionaries.TagTypes['TM'];
			const data = build_buffer_form_bytes(['0x30', '0x39', '0x34', '0x38', '0x33', '0x36', '0x2E', '0x32', '0x31', '0x34', '0x37', '0x34', '0x33', '0x39', '0x38']);
			const value = tm.extract(data);
			assert.equal('094836.21474398', value);
			assert.equal(tm.format(value), '09:48:36');
		});
	});
	describe('US', function() {
		it('should extract data from buffer and format value properly', function() {
			const us = Dictionaries.TagTypes['US'];
			const data = build_buffer_form_bytes(['0x00', '0x03']);
			const value = us.extract(data);
			assert.equal(768, value);
			assert.equal(us.format(value), '768');
		});
	});
});


