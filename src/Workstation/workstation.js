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
		return this.iris.getEntry(false, {
				keys: workstation
			})
			.catch(err => {
				return {};
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
				return this.iris.setEntry(ws.ldtype, ws);
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
				console.log("FOUND WS", _.groupBy(res, 'ldtype'));
				let to_put = _.map(res, (ws, key) => {
					let occupation = _.isArray(ws.occupied_by) ? ws.occupied_by : [ws.occupied_by];
					ws.occupied_by = _.uniq(_.filter(occupation, (user) => (user !== user_id)));
					return ws;
				});
				let p = _.map(_.groupBy(to_put, 'ldtype'), (ws, type) => {
					return this.iris.setEntry(type, ws);
				});

				return Promise.all(p);
			})
			.then((res) => {
				console.log("RS", res);
				fin = _.reduce(res, (acc, ws) => {
					_.map(ws, (val, key) => {
						acc[key] = !!val.cas;
					});
					return acc;
				}, {});
				return this.actionByAgent({
					user_id
				});
			})
			.then((res) => {
				let ws = _.filter(res, !_.isEmpty);
				console.log("WS BY AGENT", res, fin, ws);
				let filtered = _.filter(res, (ws) => {
					let occupation = _.isArray(ws.occupied_by) ? ws.occupied_by : [ws.occupied_by];
					return !!~_.indexOf(occupation, user_id);
				});
				if(_.every(filtered, _.isEmpty)) {
					return this.emitter.addTask('agent', {
						_action: 'logout',
						user_id
					});
				} else {
					return Promise.resolve(true);
				}
			})
			.then((res) => {
				console.log("LOGOUT", user_id);
				return {
					success: true,
					result: fin
				}
			});
	}

	actionSupervise() {
		return Promise.resolve(true);
	}
}

module.exports = Workstation;