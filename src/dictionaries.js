function extract_text(buffer, offset, length) {
	const characters = new Uint8Array(buffer, offset, length);
	return String.fromCodePoint(...characters);
}

function put_text(buffer, offset, text) {
	const dataview = new DataView(buffer);
	for(let i = 0; i < text.length; i++) {
		dataview.setUint8(offset + i, text.charCodeAt(i));
	}
}

//extract is used to get the bytes from the buffer and transform them into a known-type (string, number) according to dicom specifications
//parse takes the raw value (string or number) and interpret it if possible (transform a dicom date string into a real date object)
//format transforms the object value resulting from the parser into text (format a date object into something easily readable)
//clean describes how to clean a buffer from this kind of data
//all these functions are used as default for tag types
const ValueTypes = {
	'STRING' : {
		extract : extract_text,
		parse : x => x,
		format : x => x,
		clean : (buffer, offset, dataoffset, datalength) => {
			put_text(buffer, dataoffset, ''.padEnd(datalength, ' '));
		}
	},
	'DATE' : {
		extract : extract_text,
		format : x => `${x.getUTCFullYear()}-${(x.getUTCMonth() + 1).toString().padStart(2, '0')}-${x.getUTCDate().toString().padStart(2, '0')}`
	},
	'NUMBER' : {
		parse : x => x,
		format : x => x.toString()
	},
	'RAW' : {}
};

const PeriodUnits = {
	'D' : 'day(s)',
	'W' : 'week(s)',
	'M' : 'month(s)',
	'Y' : 'year(s)'
};

function format_byte(integer) {
	return integer.toString(16).padStart(2, '0');
}

const Dictionaries = {
	Helpers : {
		TagToIntegerArray : function(tag) {
			const group = tag.substring(1, 5);
			const element = tag.substring(6, 10);
			const bytes = [group.substring(2, 4), group.substring(0, 2), element.substring(2, 4), element.substring(0, 2)].map(x => '0x' + x);
			return bytes.map(x => parseInt(x));
		},
		IntegerArrayToTag : function(integers) {
			return `(${format_byte(integers[1])}${format_byte(integers[0])},${format_byte(integers[3])}${format_byte(integers[2])})`;
		}
	},
	TagTypes : {
		'AE' : {
			type : 'STRING',
			format : x => x.trim(),
			max_length : 16
		},
		'AS' : {
			type : 'STRING',
			format : function(value) {
				const unit = value.slice(-1);
				const amount = parseInt(value.slice(0, -1));
				return `${amount} ${PeriodUnits[unit]} ago`;
			},
			length : 4
		},
		'AT' : {
			type : 'STRING',
			format : x => x.trim(),
			length : 4
		},
		'CS' : {
			type : 'STRING',
			max_length : 16
		},
		'DA' : {
			type : 'DATE',
			parse : function(value) {
				const year = parseInt(value.substring(0, 4));
				const month = parseInt(value.substring(4, 6));
				const day = parseInt(value.substring(6, 8));
				return new Date(Date.UTC(year, month - 1, day));
			},
			clean : function(buffer, _, dataoffset, datalength) {
				if(datalength > 0) {
					const now = new Date();
					const date = `${now.getUTCFullYear()}${(now.getUTCMonth() + 1).toString().padStart(2, '0')}${now.getUTCDate().toString().padStart(2, '0')}`;
					put_text(buffer, dataoffset, date);
				}
			},
			length : 8
		},
		'DS' : {
			type : 'STRING',
			clean : function(buffer, offset, dataoffset, datalength) {
				put_text(buffer, dataoffset, '0'.padEnd(datalength, '0'));
			},
			max_length : 16
		},
		'DT' : {
			type : 'STRING',
			max_length : 26
		},
		'FL' : {
			type : 'NUMBER',
			extract : function(buffer, offset, length) {
				const view = new DataView(buffer, offset, length);
				return view.getFloat32(0, true);
			},
			length : 8
		},
		'FD' : {
			type : 'NUMBER',
			extract : function(buffer, offset, length) {
				const view = new DataView(buffer, offset, length);
				return view.getFloat64(0, true);
			},
			length : 8
		},
		'IS' : {
			type : 'STRING',
			max_length : 12
		},
		'LO' : {
			type : 'STRING',
			clean : function(buffer, offset, dataoffset, datalength) {
				const text = 'Anonymized'.slice(0, datalength);
				put_text(buffer, dataoffset, text.padEnd(datalength, ' '));
			}
		},
		'LT' : {
			type : 'STRING',
			clean : function(buffer, offset, dataoffset, datalength) {
				const text = 'Anonymized'.slice(0, datalength);
				put_text(buffer, dataoffset, text.padEnd(datalength, ' '));
			}
		},
		'OB' : {
			type : 'RAW'
		},
		'OD' : {
			type : 'RAW'
		},
		'OF' : {
			type : 'RAW'
		},
		'OL' : {
			type : 'RAW'
		},
		'OV' : {
			type : 'RAW'
		},
		'OW' : {
			type : 'RAW'
		},
		'PN' : {
			type : 'STRING',
			clean : function(buffer, offset, dataoffset, datalength) {
				const text = 'Anonymized'.slice(0, datalength);
				put_text(buffer, dataoffset, text.padEnd(datalength, ' '));
			}
		},
		'SH' : {
			type : 'STRING'
		},
		'SL' : {
			type : 'NUMBER',
			extract : function(buffer, offset, length) {
				const view = new DataView(buffer, offset, length);
				return view.getInt32(0, true);
			},
			length : 4
		},
		'SQ' : {
			type : 'RAW',
		},
		'SS' : {
			type : 'NUMBER',
			extract : function(buffer, offset, length) {
				const view = new DataView(buffer, offset, length);
				return view.getInt16(0, true);
			},
			length : 2
		},
		'ST' : {
			type : 'STRING'
		},
		'SV' : {
			type : 'NUMBER',
			extract : function(buffer, offset, length) {
				const view = new DataView(buffer, offset, length);
				return view.getBigInt64(0, true);
			},
			length : 8
		},
		'TM' : {
			type : 'STRING',
			format : function(value) {
				const hour = value.substring(0, 2).padStart(2, '0');
				if(value.length > 2) {
					const minute = value.substring(2, 4).padStart(2, '0');
					if(value.length > 4) {
						const second = value.substring(4, 6).padStart(2, '0');
						return `${hour}:${minute}:${second}`;
					}
					return `${hour}:${minute}`;
				}
				return `${hour}`;
			},
			clean : function(buffer, offset, dataoffset, datalength) {
				let time = '0'.padEnd(Math.min(6, datalength), '0');
				if(time.length < datalength) {
					time += '.';
					time = time.padEnd(datalength, '0');
				}
				put_text(buffer, dataoffset, time);
			},
			max_length : 16
		},
		'UC' : {
			type : 'STRING'
		},
		'UI' : {
			extract : function(buffer, offset, length) {
				let characters = new Uint8Array(buffer, offset, length);
				//last byte may be used as padding
				if(characters[characters.length - 1] === 0) {
					characters = characters.slice(0, -1);
				}
				return String.fromCodePoint(...characters);
			},
			type : 'STRING',
			max_length : 64
		},
		'UL' : {
			type : 'NUMBER',
			extract : function(buffer, offset, length) {
				const view = new DataView(buffer, offset, length);
				return view.getUint32(0, true);
			},
			length : 4
		},
		'UN' : {
			type : 'RAW',
		},
		'UR' : {
			type : 'STRING'
		},
		'US' : {
			type : 'NUMBER',
			extract : function(buffer, offset, length) {
				const view = new DataView(buffer, offset, length);
				return view.getUint16(0, true);
			}
		},
		'UT' : {
			type : 'STRING'
		},
		'UV' : {
			type : 'NUMBER',
			extract : function(buffer, offset, length) {
				const view = new DataView(buffer, offset, length);
				return view.getBigUint64(0, true);
			},
			length : 8
		}
	},
	Tags : [
		{
			id : '(0002,0000)',
			type : ['UL'],
			name : 'File Meta Information Group Length'
		},
		{
			id : '(0002,0001)',
			type : ['OB'],
			name : 'File Meta Information Version'
		},
		{
			id : '(0002,0002)',
			type : ['UI'],
			name : 'Media Storage SOP Class UID'
		},
		{
			id : '(0002,0003)',
			type : ['UI'],
			name : 'Media Storage SOP Instance UID'
		},
		{
			id : '(0002,0010)',
			type : ['UI'],
			name : 'Transfer Syntax UID'
		},
		{
			id : '(0002,0012)',
			type : ['UI'],
			name : 'Implementation Class UID'
		},
		{
			id : '(0002,0013)',
			type : ['SH'],
			name : 'Implementation Version Name'
		},
		{
			id : '(0008,0005)',
			type : ['CS'],
			name : 'Specific Character Set',
		},
		{
			id : '(0008,0008)',
			type : ['CS'],
			name : 'Image Type',
		},
		{
			id : '(0008,0016)',
			type : ['UI'],
			name : 'SOP Class UID'
		},
		{
			id : '(0008,0018)',
			type : ['UI'],
			name : 'SOP Instance UID'
		},
		{
			id : '(0008,0020)',
			type : ['DA'],
			name : 'Study Date',
			sensitive : true
		},
		{
			id : '(0008,0021)',
			type : ['DA'],
			name : 'Series Date',
			sensitive : true
		},
		{
			id : '(0008,0023)',
			type : ['DA'],
			name : 'Content Date',
			sensitive : true
		},
		{
			id : '(0008,0030)',
			type : ['TM'],
			name : 'Study Time',
			sensitive : true
		},
		{
			id : '(0008,0031)',
			type : ['TM'],
			name : 'Series Time',
			sensitive : true
		},
		{
			id : '(0008,0033)',
			type : ['TM'],
			name : 'Content Time',
			sensitive : true
		},
		{
			id : '(0008,0050)',
			type : ['SH'],
			name : 'Accession Number',
			sensitive : true
		},
		{
			id : '(0008,0051)',
			type : ['SQ'],
			name : 'Issuer of Accession Number Sequence',
			sensitive : true
		},
		{
			id : '(0008,0060)',
			type : ['CS'],
			name : 'Modality',
		},
		{
			id : '(0008,0070)',
			type : ['LO'],
			name : 'Manufacturer',
			sensitive : true
		},
		{
			id : '(0008,0080)',
			type : ['LO'],
			name : 'Institution Name',
			sensitive : true
		},
		{
			id : '(0008,0081)',
			type : ['ST'],
			name : 'Institution Address',
			sensitive : true
		},
		{
			id : '(0008,0090)',
			type : ['PN'],
			name : 'Referring Physician\'s Name',
			sensitive : true
		},
		{
			id : '(0008,0092)',
			type : ['ST'],
			name : 'Referring Physician\'s Address',
			sensitive : true
		},
		{
			id : '(0008,0094)',
			type : ['SH'],
			name : 'Referring Physician\'s Telephone Numbers',
			sensitive : true
		},
		{
			id : '(0008,0096)',
			type : ['SQ'],
			name : 'Referring Physician Identification Sequence',
			sensitive : true
		},
		{
			id : '(0008,009C)',
			type : ['PN'],
			name : 'Consulting Physician\'s Name',
			sensitive : true
		},
		{
			id : '(0008,009D)',
			type : ['SQ'],
			name : 'Consulting Physician Identification Sequence',
			sensitive : true
		},
		{
			id : '(0008,1010)',
			type : ['SH'],
			name : 'Station Name',
		},
		{
			id : '(0008,1030)',
			type : ['LO'],
			name : 'Study Description',
		},
		{
			id : '(0008,1050)',
			type : ['PN'],
			name : 'Performing Physician\'s Name',
			sensitive : true
		},
		{
			id : '(0008,1090)',
			type : ['LO'],
			name : 'Manufacturer Model Name',
			sensitive : true
		},
		{
			id : '(0008,2112)',
			type : ['SQ'],
			name : 'Source Image Sequence'
		},
		{
			id : '(0008,2144)',
			type : ['IS'],
			name : 'Recommended Display Frame Rate',
		},
		{
			id : '(0010,0010)',
			type : ['PN'],
			name : 'Patient\'s Name',
			sensitive : true
		},
		{
			id : '(0010,0020)',
			type : ['LO'],
			name : 'Patient ID',
			sensitive : true
		},
		{
			id : '(0010,0030)',
			type : ['DA'],
			name : 'Patient\'s Birth Date',
			sensitive : true
		},
		{
			id : '(0010,0032)',
			type : ['TM'],
			name : 'Patient\'s Birth Time',
			sensitive : true
		},
		{
			id : '(0010,0040)',
			type : ['CS'],
			name : 'Patient\'s Sex',
			sensitive : true
		},
		{
			id : '(0010,1020)',
			type : ['DS'],
			name : 'Patient Size',
			sensitive : true
		},
		{
			id : '(0010,1030)',
			type : ['DS'],
			name : 'Patient Weight',
			sensitive : true
		},
		{
			id : '(0010,4000)',
			type : ['LT'],
			name : 'Patient Comments',
			sensitive : true
		},
		{
			id : '(0018,0040)',
			type : ['IS'],
			name : 'Cine Rate'
		},
		{
			id : '(0018,0072)',
			type : ['DS'],
			name : 'Effective Duration'
		},
		{
			id : '(0018,1020)',
			type : ['LO'],
			name : 'Software Version(s)',
		},
		{
			id : '(0018,1063)',
			type : ['DS'],
			name : 'Frame Time'
		},
		{
			id : '(0018,1063)',
			type : ['DS'],
			name : 'Frame Time'
		},
		{
			id : '(0018,1244)',
			type : ['US'],
			name : 'Preferred Playback Sequencing'
		},
		{
			id : '(0020,000D)',
			type : ['UI'],
			name : 'Study Instance UID',
			sensitive : true
		},
		{
			id : '(0020,000E)',
			type : ['UI'],
			name : 'Series Instance UID',
			sensitive : true
		},
		{
			id : '(0020,0011)',
			type : ['IS'],
			name : 'Series Number'
		},
		{
			id : '(0020,0013)',
			type : ['IS'],
			name : 'Instance Number'
		},
		{
			id : '(0028,0002)',
			type : ['US'],
			name : 'Samples per Pixel'
		},
		{
			id : '(0028,0004)',
			type : ['CS'],
			name : 'Photometric Interpretation'
		},
		{
			id : '(0028,0008)',
			type : ['IS'],
			name : 'Number of Frames'
		},
		{
			id : '(0028,0009)',
			type : ['AT'],
			name : 'Frame Increment Pointer'
		},
		{
			id : '(0028,0010)',
			type : ['US'],
			name : 'Rows'
		},
		{
			id : '(0028,0011)',
			type : ['US'],
			name : 'Columns'
		},
		{
			id : '(0028,0100)',
			type : ['US'],
			name : 'Bits Allocated'
		},
		{
			id : '(0028,0101)',
			type : ['US'],
			name : 'Bits Stored'
		},
		{
			id : '(0028,0102)',
			type : ['US'],
			name : 'High Bit'
		},
		{
			id : '(0028,0103)',
			type : ['US'],
			name : 'Pixel Representation'
		},
		{
			id : '(7FE0,0008)',
			type : ['OF'],
			name : 'Float Pixel Data'
		},
		{
			id : '(7FE0,0009)',
			type : ['OD'],
			name : 'Double Float Pixel Data'
		},
		{
			id : '(7FE0,0010)',
			type : ['OB', 'OW'],
			name : 'Pixel Data'
		}
	]
};

function enhance_tag_type(tag_type) {
	const type = ValueTypes[tag_type.type];
	//take default functions from type
	tag_type.extract = tag_type.extract || type.extract;
	tag_type.parse = tag_type.parse || type.parse;
	tag_type.format = tag_type.format || type.format;
	tag_type.clean = tag_type.clean || type.clean;
}

Object.entries(Dictionaries.TagTypes).forEach(function(entry) {
	//add id to all tag types
	entry[1].id = entry[0];
	//add default parse and format functions to all tags types
	enhance_tag_type(entry[1]);
});

function enhance_tag(tag) {
	tag.group = tag.id.substring(1, 5);
	tag.element = tag.id.substring(6, 10);
	const bytes = [tag.group.substring(2, 4), tag.group.substring(0, 2), tag.element.substring(2, 4), tag.element.substring(0, 2)].map(x => '0x' + x);
	tag.values = bytes.map(x => parseInt(x));
	const tag_type = Dictionaries.TagTypes[tag.type[0]];
	tag.clean = tag.clean || tag_type.clean;
}

//add integer values for all tags
Dictionaries.Tags.forEach(enhance_tag);

export default Dictionaries;
