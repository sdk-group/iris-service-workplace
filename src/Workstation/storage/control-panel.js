'use strict';

const BasicCache = require("./basic.js");

class ControlPanelCache extends BasicCache {

	addSection(name, data) {
		super.addSection(name, _.filter(data, w => (w && (w.device_type == 'control-panel'))));
	}

	addWorkstation(ws) {
		if (!ws || ws.get("device_type") != 'control-panel')
			return;
		let section = ws.get("attached_to");
		this.appendSection(section, ws);
	}

	findIdsByFilter(section, filter_fn) {
		let all = _.filter(Object.keys(this._keymap), k => (this.find(k)
			.get("attached_to") == section));
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
		let all = _.filter(Object.keys(this._keymap), k => (this.find(k)
			.get("attached_to") == section));
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
}

let instance = new ControlPanelCache();
module.exports = instance;