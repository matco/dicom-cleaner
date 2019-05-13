'use strict';

//Generic
['indexOf', 'first', 'last', 'isEmpty', 'includes', 'slice', 'sort', 'forEach', 'map', 'find', 'filter', 'every', 'some'].forEach(function(method) {
	//NodeList
	if(!NodeList.prototype.hasOwnProperty(method)) {
		NodeList.prototype[method] = Array.prototype[method];
	}
	//DOMStringList
	if(!DOMStringList.prototype.hasOwnProperty(method)) {
		DOMStringList.prototype[method] = Array.prototype[method];
	}
	//HTMLCollection
	if(!HTMLCollection.prototype.hasOwnProperty(method)) {
		HTMLCollection.prototype[method] = Array.prototype[method];
	}
});

//DOM
//Node
Node.prototype.clear = function() {
	while(this.firstChild) {
		this.removeChild(this.firstChild);
	}
	//allow chain
	return this;
};
Node.prototype.appendChildren = function(children) {
	children.forEach(Node.prototype.appendChild, this);
	//allow chain
	return this;
};
/*Node.prototype.up = function(tag) {
	if(this.parentNode.nodeName.toLowerCase() === tag.toLowerCase()) {
		return this.parentNode;
	}
	return this.parentNode.up(tag);
};*/

//Element
Element.prototype.clear = function(selector) {
	let children = this.childNodes.slice();
	if(selector) {
		children = children.filter(c => c.nodeType === Node.ELEMENT_NODE && c.matches(selector));
	}
	children.forEach(c => this.removeChild(c));
	//allow chain
	return this;
};
Element.prototype.setAttributes = function(attributes) {
	if(attributes) {
		for(const attribute in attributes) {
			if(attributes.hasOwnProperty(attribute)) {
				this.setAttribute(attribute, attributes[attribute]);
			}
		}
	}
	//allow chain
	return this;
};

//Document
(function() {
	function enhance_element(element, attributes, text, listeners) {
		element.setAttributes(attributes);
		if(text !== undefined) {
			element.appendChild(this.createTextNode(text));
		}
		if(listeners) {
			for(const listener in listeners) {
				if(listeners.hasOwnProperty(listener)) {
					element.addEventListener(listener, listeners[listener], false);
				}
			}
		}
		return element;
	}

	Document.prototype.createFullElement = function(tag, attributes, text, listeners) {
		return enhance_element.call(this, this.createElement(tag), attributes, text, listeners);
	};
	Document.prototype.createFullElementNS = function(ns, tag, attributes, text, listeners) {
		return enhance_element.call(this, this.createElementNS(ns, tag), attributes, text, listeners);
	};
})();

//HTML
//HTMLElement
HTMLElement.prototype.getPosition = function() {
	const position = {left : this.offsetLeft, top : this.offsetTop};
	if(this.offsetParent) {
		const parent_position = this.offsetParent.getPosition();
		return {left : parent_position.left + position.left, top : parent_position.top + position.top};
	}
	return position;
};

//HTMLFormElement
HTMLFormElement.prototype.disable = function() {
	this.elements.forEach(e => e.setAttribute('disabled', 'disabled'));
};

HTMLFormElement.prototype.enable = function() {
	this.elements.forEach(e => e.removeAttribute('disabled'));
};

//HTMLSelectElement
HTMLSelectElement.prototype.fill = function(entries, blank_entry, selected_entries) {
	//transform entries if an array has been provided
	let options;
	if(Array.isArray(entries)) {
		options = {};
		for(let i = 0; i < entries.length; i++) {
			//html options can only be strings
			const entry = entries[i] + '';
			options[entry] = entry;
		}
	}
	else {
		options = Object.clone(entries);
	}
	//transform selected entries
	const selected_options = selected_entries ? Array.isArray(selected_entries) ? selected_entries : [selected_entries] : [];
	//clean and update existing options
	const children = Array.prototype.slice.call(this.childNodes);
	for(let i = 0; i < children.length; i++) {
		const option = children[i];
		//do not manage empty option here
		if(option.value) {
			//remove option if it is no more needed
			if(!options.hasOwnProperty(option.value)) {
				this.removeChild(option);
			}
			//remove option from list of options to add
			else {
				delete options[option.value];
			}
		}
		//unselect or select option according to new selection
		if(!selected_options.includes(option.value)) {
			option.removeAttribute('selected');
		}
		else {
			option.setAttribute('selected', 'selected');
		}
	}
	//manage blank option
	//look for current blank option
	const blank_option = this.childNodes.find(function(option) {return !option.value;});
	//remove blank option if it has been found and is not needed
	if(blank_option && !blank_entry) {
		this.removeChild(blank_option);
	}
	//add blank option if it has not been found and is needed
	else if(!blank_option && blank_entry) {
		this.insertBefore(document.createElement('option'), this.firstChild);
	}
	//add missing options
	//TODO do not append missing options at the end of the list
	let properties;
	for(const option in options) {
		if(options.hasOwnProperty(option)) {
			properties = {value : option};
			if(selected_options.includes(properties.value)) {
				properties.selected = 'selected';
			}
			this.appendChild(document.createFullElement('option', properties, options[option]));
		}
	}
	//allow chain
	return this;
};
HTMLSelectElement.prototype.fillObjects = function(objects, value_property, label_property, blank_entry, selected_entries) {
	const entries = {};
	for(let i = 0; i < objects.length; i++) {
		const object = objects[i];
		const value = Function.isFunction(value_property) ? value_property.call(object) : object[value_property];
		const label = Function.isFunction(label_property) ? label_property.call(object) : object[label_property];
		entries[value] = label;
	}
	return this.fill(entries, blank_entry, selected_entries);
};

//HTMLDataListElement
HTMLDataListElement.prototype.fill = HTMLSelectElement.prototype.fill;
HTMLDataListElement.prototype.fillObjects = HTMLSelectElement.prototype.fillObjects;

//Storage
Storage.prototype.setObject = function(key, value) {
	this.setItem(key, JSON.stringify(value));
};
Storage.prototype.getObject = function(key) {
	const item = this.getItem(key);
	return item ? JSON.parse(item) : undefined;
};

//Event
Event.stop = function(event) {
	if(event) {
		event.stopPropagation();
		event.preventDefault();
	}
};
