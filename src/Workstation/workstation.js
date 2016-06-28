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
				return Promise.mapSeries(_.values(res), (org) => {
						return this.actionCacheWorkstations({
							organization: org['@id']
						});
					})
					.then(() => {
						return this.actionScheduleLogoutAll({
							organization: _.map(res, '@id')
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
				let to_logout = _.filter(res, org => !_.isUndefined(org.org_merged.auto_logout_time));
				let times = {};
				return Promise.map(to_logout, (org) => {
					let t = moment.tz(org.org_merged.auto_logout_time, 'HH:mm', org.org_merged.org_timezone);
					let tm = t.diff(moment.tz(org.org_merged.org_timezone), 'seconds') % 86400;
					if (tm <= 0) tm = 86400 + tm;
					times[tm] = times[tm] || [];
					let org_id = org.org_merged.id;
					return this.emitter.addTask('taskrunner.add.task', {
						time: tm,
						task_name: "",
						solo: true,
						cancellation_code: org_id,
						module_name: "workstation",
						task_id: "auto-logout-all",
						task_type: "add-task",
						ahead: false,
						params: {
							_action: "auto-logout-all",
							organization: org_id
						}
					});
				});
			});
	}

	actionAutoLogoutAll({
		organization
	}) {
		return this.actionScheduleLogoutAll({
				organization
			})
			.then(res => {
				return this.actionLogoutAll({
					organization
				});
			});
	}

	actionLogoutAll({
		organization
	}) {
		let to_logout_ws;
		return Promise.map(_.castArray(organization), (org) => {
				return this.emitter.addTask('agent', {
					_action: 'logout-all',
					organization: org
				});
			})
			.then((res) => {
				return Promise.map(_.castArray(organization), (org) => {
					return this.actionGetWorkstationsCache({
						organization: org,
						device_type: ['control-panel']
					});
				});
			})
			.then(res => {
				to_logout_ws = _(res)
					.flatMap('control-panel')
					.compact()
					.flatMap('id')
					.value();

				return Promise.map(to_logout_ws, workstation => this.actionClearOccupation({
					workstation
				}));
			})
			.then((res) => {
				return Promise.map(_.castArray(organization), (org) => {
					return this.actionCacheWorkstations({
						organization: org
					});
				});
			})
			.then(res => {
				global.logger && logger.info({
					module: 'workstation',
					method: 'logout-all',
					organization,
					to_logout_ws
				}, 'Logged out: ');
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
		return Promise.map(_.castArray(organization), (org) => this.actionGetWorkstationsCache({
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
				return this.actionCacheWorkstations({
					organization: ws.attached_to,
					workstation
				});
			})
			.then(res => {
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
		console.log("LEAVE", user_id, workstation);
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
				let p = _(ws)
					.flatMap('attached_to')
					.uniq()
					.compact()
					.value();
				return Promise.map(p, (org_id) => {
					return this.actionCacheWorkstations({
						organization: org_id,
						workstation
					});
				});
			})
			.then(res => {
				return this.actionByAgent({
					user_id,
					organization: _(ws)
						.flatMap('attached_to')
						.uniq()
						.compact()
						.value()
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