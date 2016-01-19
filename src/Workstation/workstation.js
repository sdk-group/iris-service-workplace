'use strict'

let emitter = require("global-queue");
let WorkstationApi = require('resource-management-framework').WorkstationApi;

class Workstation {
	constructor() {
		this.emitter = emitter;
	}

	init() {
		this.iris = new WorkstationApi();
		this.iris.initContent();
	}

	//API
	actionType() {}

	actionById({
		data: {
			workstation
		}
	}) {
		return this.iris.getWorkstation({
			keys: [workstation]
		});
	}

	actionByOperator({
		data: {
			operator
		}
	}) {
		return this.iris.getWorkstation({
			query: {
				occupied_by: operator
			}
		});
	}

	actionAvailable() {}
	actionExecuteCommand() {}

	actionWorkstation({
		data: {
			query
		}
	}) {
		return this.iris.getWorkstation({
			query
		});
	}
	actionOccupy({
		data: {
			workstation,
			operator
		}
	}) {
		return this.iris.setWorkstationField({
			keys: workstation
		}, {
			occupied_by: operator
		});
	}
	actionSupervise() {}
}

module.exports = Workstation;