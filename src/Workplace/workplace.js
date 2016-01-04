'use strict'

let emitter = require("global-queue");
let WorkplaceApi = require('resource-managment-framework').WorkplaceApi;

class Workplace {
	constructor() {
		this.emitter = emitter;
	}

	init(config) {
		let bname = config.bucket;
		this.iris = new WorkplaceApi();
		this.iris.init(bname);
	}

	//API
	getType() {}
	getById() {}
	getByOperator() {}
	getAvailable() {}
	executeCommand() {}
	getWorkplace() {}
	occupy() {}
	supervise() {}
}

module.exports = Workplace;