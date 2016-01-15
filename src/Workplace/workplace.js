'use strict'

let emitter = require("global-queue");
let WorkplaceApi = require('resource-management-framework').WorkplaceApi;

class Workplace {
	constructor() {
		this.emitter = emitter;
	}

	init() {
		this.iris = new WorkplaceApi();
		this.iris.initContent();
	}

	//API
	actionType() {}

	actionById({
		data: {
			workplace
		}
	}) {
		return this.iris.getWorkplace({
			keys: [workplace]
		});
	}

	actionByOperator({
		data: {
			operator
		}
	}) {
		return this.iris.getWorkplace({
			query: {
				occupied_by: operator
			}
		});
	}

	actionAvailable() {}
	actionExecuteCommand() {}

	actionWorkplace({
		data: {
			query
		}
	}) {
		return this.iris.getWorkplace({
			query
		});
	}
	actionOccupy({
		data: {
			workplace,
			operator
		}
	}) {
		return this.iris.setWorkplaceField({
			keys: workplace
		}, {
			occupied_by: operator
		});
	}
	actionSupervise() {}
}

module.exports = Workplace;