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
	actionType({
		workstation
	}) {
		return this.iris.getWorkstation({
				keys: [workstation]
			})
			.then((res) => {
				return _.mapValues(res, val => val.device_type);
			});
	}

	actionById({
		workstation
	}) {
		return this.iris.getWorkstation({
			keys: [workstation]
		});
	}

	actionByOperator({
		operator
	}) {
		return this.iris.getWorkstation({
			query: {
				occupied_by: operator
			}
		});
	}

	actionAvailable() {
		return Promise.resolve(true);
	}
	actionExecuteCommand() {
		return Promise.resolve(true);
	}

	actionWorkstation({
		query
	}) {
		console.log("WS ACTS");
		return this.iris.getWorkstation({
			query
		});
	}

	actionOccupy({
		workstation,
		operator
	}) {
		return this.iris.setWorkstationField({
				keys: workstation
			}, {
				occupied_by: operator
			}, true)
			.then((res) => {
				console.log("OCCUPIED", res);
				return this.emitter.addTask('agent', {
					_action: 'login',
					user_id: operator
				});
			});
	}

	actionSupervise() {
		return Promise.resolve(true);
	}
}

module.exports = Workstation;