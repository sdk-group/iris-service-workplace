'use strict';
class BasicWorkstationCache {
	constructor() {
		this.flush();
	}

	flush() {
		this._content = {};
		this._updates = {};
		this._keymap = {};
	}

	addSection(name, data) {
		if (!name) return;
		this._content[name] = data || []; //new Section(name, data);
		this._updates[name] = _.now();
		this._buildKeymap(name);
	}

	_buildKeymap(section) {
		let sections = section ? _.castArray(section) : Object.keys(this._content);
		let sl = sections.length,
			l, sname, sdata;
		while (sl--) {
			sname = sections[sl];
			sdata = this._content[sname];
			l = sdata.length;
			while (l--) {
				this._keymap[sdata[l].id] = `${sname}.${l}`;
			}
		}
	}

	find(id) {
		if (!this._keymap[id]) {
			return false;
		}
		return _.get(this._content, this._keymap[id]);
	}

	findAll(ids) {
		return _.map(ids, id => this.find(id));
	}

	removeSection(name) {
		_.unset(this._content, name);
		_.unset(this._updates, name);
		this._buildKeymap();
	}

	appendSection(section, entity) {
		if (!entity || !section || !this._content[section])
			return;
		if (this.find(entity.id))
			return;
		this._content[section].push(entity);
		this._keymap[entity.id] = `${section}.${this._content[section].length-1}`;
	}
}

module.exports = BasicWorkstationCache;