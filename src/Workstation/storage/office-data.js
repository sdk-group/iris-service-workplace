'use strict';

const BasicCache = require("./basic.js");

class OfficeDataCache extends BasicCache {

	addSection(name, data) {
		if (!data)
			return;
		super.addSection(name, data);
	}

	findSectionByFilter(filter_fn) {
		let all = Object.keys(this._keymap);
		if (!filter_fn)
			return all;
		let l = all.length,
			result = [],
			curr;
		while (l--) {
			curr = this.find(all[l]);
			if (filter_fn(curr))
				result.push(curr.id);
		}
		return result;
	}

	findByFilter(section, filter_fn) {
		let all = Object.keys(this._keymap);

		if (!filter_fn)
			return this.findAll(all);
		let l = all.length,
			result = [],
			curr;
		while (l--) {
			curr = this.find(all[l]);
			if (filter_fn(curr))
				result.push(curr);
		}
		return result;
	}

	_buildKeymap(section) {
		let sections = section ? _.castArray(section) : Object.keys(this._content);
		let sl = sections.length,
			sname, sdata;
		while (sl--) {
			sname = sections[sl];
			sdata = this._content[sname];
			this._keymap[sname] = sname;
		}
	}

	findAll(ids) {
		return _.reduce(ids, (acc, id) => {
			acc[id] = this.find(id);
			return acc;
		}, {});
	}
}

let instance = new OfficeDataCache();
module.exports = instance;