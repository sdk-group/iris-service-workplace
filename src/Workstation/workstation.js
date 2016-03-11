'use strict'

let emitter = require("global-queue");
let WorkstationApi = require('resource-management-framework')
	.WorkstationApi;

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
		return this.iris.getEntryTypeless(workstation)
			.catch(err => {
				console.log("WS ERR", err.stack);
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

	actionWorkstationOrganizationData({
		workstation,
		embed_schedules = false
	}) {
		let ws;
		return this.iris.getEntryTypeless(_.castArray(workstation))
			.then((res) => {
				ws = _.values(res);
				if (embed_schedules) {
					return this.iris.getWorkstationOrganizationSchedulesChain(_.map(ws, 'attached_to'));
				} else {
					return this.iris.getWorkstationOrganizationChain(_.map(ws, 'attached_to'));
				}
			})
			.then((offices) => {
				// console.log("WS OFFC", require('util')
				// 	.inspect(offices, {
				// 		depth: null
				// 	}));
				return _.reduce(ws, (acc, ws_data) => {
					let org_chain = offices[ws_data.attached_to];
					let org_addr = [];
					let org_merged = _.reduce(_.orderBy(_.keys(org_chain), _.parseInt, 'desc'), (acc, val) => {
						acc = _.merge(acc, org_chain[val]);
						org_addr.push(org_chain[val].id);
						return acc;
					}, {});
					org_addr = _.join(org_addr, ".");
					acc[ws_data.id] = {
						ws: ws_data,
						org_addr,
						org_chain,
						org_merged
					};
					return acc;
				}, {});
				// console.log("WS RESULT", require('util')
				// 	.inspect(result, {
				// 		depth: null
				// 	}));
			});
	}

	actionOrganizationData({
		organization
	}) {
		return this.iris.getWorkstationOrganizationChain(organization)
			.then(res => {
				return _.mapValues(res, (org_chain) => {
					let org_addr = [];
					let org_merged = _.reduce(_.orderBy(_.keys(org_chain), _.parseInt, 'desc'), (acc, val) => {
						acc = _.merge(acc, org_chain[val]);
						org_addr.push(org_chain[val].id);
						return acc;
					}, {});
					org_addr = _.join(org_addr, ".");
					return {
						org_addr,
						org_chain,
						org_merged
					};
				});
			});
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
		return this.iris.getEntryTypeless(workstation)
			.then((res) => {
				ws = res[workstation];
				if (!ws)
					return Promise.reject(new Error("No such workstations."));
				let occupation = ws.occupied_by || [];
				occupation = _.castArray(occupation);
				ws.occupied_by = _.uniq(_.concat(occupation, user_id));
				return this.iris.setEntry(ws.type, ws);
			})
			.then((res) => {
				return this.emitter.addTask('agent', {
					_action: 'login',
					user_id
				});
			})
			.then((res) => {
				if (!res.success)
					return Promise.reject(new Error("Failed to login user."));
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
		return this.iris.getEntryTypeless(workstation)
			.then((res) => {
				let to_put = _.map(res, (ws, key) => {
					let occupation = _.castArray(ws.occupied_by);
					ws.occupied_by = _.uniq(_.filter(occupation, (user) => (user !== user_id)));
					return ws;
				});
				let p = _.map(_.groupBy(to_put, 'type'), (ws, type) => {
					return this.iris.setEntry(type, ws);
				});

				return Promise.all(p);
			})
			.then((res) => {
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
				let flattened = _.flatMap(res, (v) => _.values(v));
				let filtered = _.filter(flattened, (ws) => {
					let occupation = _.castArray(ws.occupied_by);
					return !!~_.indexOf(occupation, user_id);
				});
				// console.log("WS BY AGENT", fin, flattened, filtered);
				return !_.isEmpty(filtered) ? Promise.resolve(true) : this.emitter.addTask('agent', {
					_action: 'logout',
					user_id
				});
			})
			.then((res) => {
				console.log("LOGOUT", user_id);
				return {
					success: true,
					result: fin
				}
			})
			.catch(err => {
				return {
					success: false
				};
			});
	}

	actionSupervise() {
		return Promise.resolve(true);
	}
}

module.exports = Workstation;
