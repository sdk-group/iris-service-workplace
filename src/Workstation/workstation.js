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
		console.log("WS GET", workstation);
		return this.iris.getWorkstation({
				keys: workstation
			})
			.catch(err => {
				console.log("ERR WS", err.message);
				return {};
			})
			.then((res) => {
				console.log("WS", res);
				return res;
			});
	}

	actionByAgent({
		user_id
	}) {
		return this.iris.getAllEntries({
			query: {
				occupied_by: user_id
			}
		});
	}

	actionExecuteCommand() {
		return Promise.resolve(true);
	}

	actionWorkstation({
		query
	}) {
		return this.iris.getAllEntries({
			query
		});
	}

	actionOccupy({
		workstation,
		user_id
	}) {
		let ws;
		return this.iris.getEntry(false, {
				keys: workstation
			})
			.then((res) => {
				ws = _.sample(res);
				if(!ws)
					return Promise.reject(new Error("No such workstations."));
				let occupation = _.isArray(ws.occupied_by) ? ws.occupied_by : [ws.occupied_by];
				ws.occupied_by = _.uniq(_.concat(occupation, user_id));
				return this.iris.setEntry(ws.class, ws);
			})
			.then((res) => {
				return this.emitter.addTask('agent', {
					_action: 'login',
					user_id
				});
			})
			.then((res) => {
				if(!res[user_id])
					return Promise.reject("Failed to login user.");
				return {
					workstation: ws
				};
			});
	}

	actionLeave({
		user_id,
		workstation
	}) {
		let fin;
		return this.iris.getEntry(false, {
				keys: workstation
			})
			.then((res) => {
				let to_put = _.map(res, (ws, key) => {
					let occupation = _.isArray(ws.occupied_by) ? ws.occupied_by : [ws.occupied_by];
					ws.occupied_by = _.uniq(_.filter(occupation, (user) => (user !== user_id)));
					return ws;
				});
				return this.iris.setWorkstation(to_put);
			})
			.then((res) => {
				fin = _.mapValues(res, (ws) => !!ws.cas);
				return this.actionByAgent({
					user_id
				});
			})
			.then((res) => {
				if(_.every(res, _.isEmpty))
					return this.emitter.addTask('agent', {
						_action: 'logout',
						user_id
					});
				else
					return Promise.resolve(true);
			})
			.then((res) => fin);
	}

	actionSupervise() {
		return Promise.resolve(true);
	}
}

module.exports = Workstation;