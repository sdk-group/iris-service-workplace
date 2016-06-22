'use strict'


let WorkstationApi = require('resource-management-framework')
	.WorkstationApi;

class Workstation {
	constructor() {
		this.emitter = message_bus;
	}

	init() {
		this.iris = new WorkstationApi();
		this.iris.initContent();
	}
	launch() {
		return this.iris.getOrganizationTree()
			.then((res) => {
				return Promise.map(_.values(res), (org) => {
					this.emitter.addTask('taskrunner.add.task', {
						time: 0,
						task_name: "",
						solo: true,
						module_name: "workstation",
						task_id: "cache-workstations",
						task_type: "add-task",
						params: {
							_action: "cache-workstations",
							organization: org['@id']
						}
					});
					this.emitter.addTask('taskrunner.add.task', {
						time: 0,
						task_name: "",
						solo: true,
						module_name: "workstation",
						task_id: "schedule-logout-all",
						task_type: "add-task",
						params: {
							_action: "schedule-logout-all",
							organization: org['@id']
						}
					});
				});
				return Promise.resolve(true);
			});
	}

	//API
	actionScheduleLogoutAll({
		organization
	}) {
		return this.actionOrganizationData({
				organization
			})
			.then((res) => {
				let time = res[organization].org_merged.auto_logout_time;
				let timezone = res[organization].org_merged.org_timezone;
				if (time) {
					let t = moment.tz(time, 'HH:mm', timezone);
					let tm = t.diff(moment.tz(timezone), 'seconds') % 86400;
					if (tm <= 0) tm = 86400 + tm;

					this.emitter.addTask('taskrunner.add.task', {
						time: tm,
						task_name: "",
						solo: true,
						ahead: false,
						module_name: "workstation",
						task_id: "auto-logout-all",
						task_type: "add-task",
						ahead: false,
						params: {
							_action: "auto-logout-all",
							organization,
							timezone,
							time
						}
					});
				}
				return true;
			});
	}

	actionAutoLogoutAll({
		organization,
		timezone,
		time
	}) {
		this.actionScheduleLogoutAll({
			organization,
			timezone,
			time
		});
		return this.actionLogoutAll({
			organization
		});
	}

	actionLogoutAll({
		organization
	}) {
		let to_logout_ws;
		return this.actionGetWorkstationsCache({
				organization,
				device_type: ['control-panel']
			})
			.then(res => {
				let ws = res['control-panel'];
				let to_logout_agents = _.uniq(_.flatMap(ws, 'occupied_by'));
				to_logout_ws = _.map(ws, 'id');
				console.log(to_logout_ws, to_logout_agents);
				return this.emitter.addTask('agent', {
					_action: 'logout',
					user_id: to_logout_agents
				});
			})
			.then(res => {
				return Promise.map(to_logout_ws, workstation => this.actionClearOccupation({
					workstation
				}));
			})
			.then((res) => {
				this.emitter.addTask('taskrunner.add.task', {
					time: 0,
					task_name: "",
					solo: true,
					module_name: "workstation",
					task_id: "cache-workstations",
					task_type: "add-task",
					params: {
						_action: "cache-workstations",
						organization
					}
				});
				console.log("CLEAR LOGINS");
				return true;
			});
	}

	actionClearOccupation({
		workstation
	}) {
		return this.iris.getEntryTypeless(workstation)
			.then((res) => {
				let ws = _.map(_.filter(res, r => !_.isEmpty(r.occupied_by)), w => {
					w.occupied_by = [];
					return w;
				});
				return this.iris.setEntryTypeless(ws);
			});
	}

	actionCacheWorkstations({
		organization,
		workstation
	}) {
		return this.iris.updateWorkstationsCache(organization, _.castArray(workstation));
	}


	actionType({
		workstation
	}) {
		return this.iris.getWorkstation({
				keys: [workstation]
			})
			.then((res) => _.mapValues(res, val => val.device_type));
	}

	actionById({
		workstation
	}) {
		return this.iris.getEntryTypeless(workstation);
	}

	actionByAgent({
		user_id,
		organization
	}) {
		return Promise.map(organization, (org) => this.actionGetWorkstationsCache({
				organization: org
			}))
			.then((res) => {
				let data = _.reduce(res, (acc, org_data) => {
					_.mergeWith(acc, org_data, (objValue, srcValue) => {
						return _.concat(objValue || [], srcValue || []);
					});
					return acc;
				}, {});
				return _.reduce(data, (acc, val, key) => {
					acc[_.upperFirst(_.camelCase(key))] = _.filter(val, (v) => !_.isEmpty(_.intersection(_.castArray(v.occupied_by), _.castArray(user_id))));
					return acc;
				}, {});
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
				// console.log("WS OFFC", workstation, require('util')
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

	actionOrganizationTimezones() {
		return this.iris.getOrganizationTimezones();
	}

	actionOrganizationData({
		organization,
		embed_schedules = false
	}) {
		return (embed_schedules ? this.iris.getWorkstationOrganizationSchedulesChain(organization) : this.iris.getWorkstationOrganizationChain(organization))
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
		workstation,
		parent,
		satellite_type
	}) {
		return ((parent && satellite_type) ?
				this.actionSatellite({
					parent,
					satellite_type
				}) : this.iris.getEntryTypeless(workstation))
			.catch(err => ({}));
	}

	actionSatellite({
		parent,
		satellite_type
	}) {
		let type = _.upperFirst(_.camelCase(satellite_type));
		return this.iris.getEntry(type, {
			query: {
				parent
			}
		});
	}

	actionGetWorkstationsCache({
		device_type,
		organization
	}) {
		return this.iris.getWorkstationsCache(organization)
			.then((res) => device_type ? _.pick(res, device_type) : res);
	}

	actionActiveWorkstations({
		organization,
		device_type
	}) {
		return this.actionGetWorkstationsCache({
				organization,
				device_type
			})
			.then((res) => _.mapValues(res, v => _.filter(v, 'active')));
	}

	actionOccupy({
		workstation,
		user_id,
		user_type
	}) {
		let ws;
		console.log("WS OCC", workstation, user_id, user_type);
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
				this.emitter.command('taskrunner.add.task', {
					time: 0,
					task_name: "",
					solo: true,
					module_name: "workstation",
					task_id: "cache-workstations",
					task_type: "add-task",
					params: {
						_action: "cache-workstations",
						organization: ws.attached_to,
						workstation
					}
				});
				return this.emitter.addTask('agent', {
					_action: 'login',
					user_id,
					user_type,
					workstation
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
		let ws;
		return this.iris.getEntryTypeless(workstation)
			.then((res) => {
				ws = res;
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
					user_id,
					organization: _(ws)
						.map('attached_to')
						.uniq()
						.compact()
						.value()
				});
			})
			.then((res) => {
				this.emitter.command('taskrunner.add.task', {
					time: 0,
					task_name: "",
					solo: true,
					module_name: "workstation",
					task_id: "cache-workstations",
					task_type: "add-task",
					params: {
						_action: "cache-workstations",
						organization: _.uniq(_.map(ws, 'attached_to')),
						workstation
					}
				});
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
				console.log("ERR", err.stack);
				global.logger && logger.error(
					err, {
						module: 'workstation',
						method: 'leave'
					});
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