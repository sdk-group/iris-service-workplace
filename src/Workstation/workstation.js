'use strict'


let WorkstationApi = require('resource-management-framework')
	.WorkstationApi;
let Patchwerk = require("patchwerk");
let WorkstationCache = require("./storage/control-panel.js");

class Workstation {
	constructor() {
		this.emitter = message_bus;
	}

	init() {
		this.iris = new WorkstationApi();
		this.iris.initContent();

		this.patchwerk = Patchwerk(this.emitter);
	}
	launch() {
		return this.iris.getOrganizationTree()
			.then((res) => {
				let org_keys = _.map(res, '@id');

				this.emitter.on('engine.ready', () => {
					return this._fillControlPanelCache(org_keys);
				});

				return this.actionScheduleLogoutAll({
					organization: org_keys
				});
			})
			.then(res => true);
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
							organization: org_id,
							org_addr: org.org_addr
						}
					});
				});
			});
	}

	actionAutoLogoutAll({
		organization,
		org_addr
	}) {
		return this.actionScheduleLogoutAll({
				organization
			})
			.then(res => {
				return this.actionLogoutAll({
					organization: organization,
					org_addr: org_addr
				});
			});
	}


	actionLogoutAll({
		organization,
		org_addr
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
				_.map(to_logout_ws, (ws) => {
					let to_join = ['command.logout', org_addr, ws];
					this.emitter.emit('broadcast', {
						event: _.join(to_join, ".")
					});
				});

				global.logger && logger.info({
					module: 'workstation',
					method: 'logout-all',
					organization,
					to_logout_ws
				}, 'Logged out: ');
				console.log("CLEAR LOGINS");
				return this._fillControlPanelCache(org_keys);
			})
			.then(res => {
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
					w.state = 'inactive';
					return w;
				});
				return this.iris.setEntryTypeless(ws);
			});
	}

	actionById({
		workstation
	}) {
		return this.iris.getEntryTypeless(workstation);
	}

	_fillControlPanelCache(org_keys) {
		console.log(org_keys);
		WorkstationCache.flush();
		return Promise.map(org_keys, org => this.patchwerk.get("Workstation", {
				department: org,
				counter: "*"
			})
			.then(res => {
				if (res.length == 1 && res[0].id == 'undefined')
					return false;
				WorkstationCache.addSection(org, res);
				return true;
			}));
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
				return _.mapValues(data, (val) => _.filter(val, (v) => v && !_.isEmpty(_.intersection(_.castArray(v.occupied_by), _.castArray(user_id)))));
			});
	}

	_findWorkstationsOrSatellites(ids) {
		return Promise.map(_.castArray(ids), id => {
			let ws = WorkstationCache.find(id);
			if (ws)
				return ws.serialize();
			return this.iris.getEntryTypeless(id)
				.then(res => res[id]);
		});
	}

	actionWorkstationOrganizationData({
		workstation,
		embed_schedules = false
	}) {
		let ws;
		return this._findWorkstationsOrSatellites(workstation)
			.then((res) => {
				ws = res;
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
				return _.reduce(ws, (acc, ws_obj) => {
					let org_chain = offices[ws_obj.attached_to];
					let org_addr = [];
					let org_merged = _.reduce(_.orderBy(_.keys(org_chain), _.parseInt, 'desc'), (acc, val) => {
						acc = _.merge(acc, org_chain[val]);
						org_addr.push(org_chain[val].id);
						return acc;
					}, {});
					org_addr = _.join(org_addr, ".");
					acc[ws_obj.id] = {
						ws: ws_obj,
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


	actionResourceKeys({
		organization,
		state = ['active'],
		device_type
	}) {
		if (device_type == 'control-panel') {
			let filter_fn = function (ws) {
				return (state === '*' || !!~state.indexOf(ws.get("state")));
			}
			return {
				all: WorkstationCache.findIdsByFilter(organization),
				active: WorkstationCache.findIdsByFilter(organization, filter_fn)
			}
		} else
			throw new Error("Should not get here")


		// return this.actionGetWorkstationsCache({
		// 		organization,
		// 		device_type
		// 	})
		// 	.then((res) => {
		// 		let active = [];
		// 		let all = _.flatMap(res, (v, dt) => {
		// 			return _.map(v, (vv) => {
		// 				if (state === '*' || !!~state.indexOf(vv.state)) {
		// 					active.push(vv.id);
		// 				}
		// 				return vv.id;
		// 			});
		// 		});
		// 		// console.log(all, active);
		// 		return {
		// 			all: all,
		// 			active: active
		// 		};
		// 	});
	}

	actionProviders({
		organization,
		state = ['active'],
		device_type
	}) {
		if (device_type == 'control-panel') {
			let ids = WorkstationCache.findByFilter(organization, (ws) => {
				return (state === '*' || !!~state.indexOf(ws.get("state")));
			});
			let result = {},
				l = ids.length;
			while (l--) {
				console.log("PROV", ids[l]);
				result[ids[l].id] = ids[l].serialize();
			}
			console.log("RESULTPROV", result);
			return result;
		} else
			throw new Error("Should not get here")


		// return this.actionGetWorkstationsCache({
		// 		organization,
		// 		device_type
		// 	})
		// 	.then((res) => {
		// 		let active = {},
		// 			l;
		// 		_.map(res, (v) => {
		// 			l = v.length;
		// 			while (l--) {
		// 				if (state === '*' || !!~state.indexOf(v[l].state)) {
		// 					active[v[l].id] = v[l];
		// 				}
		// 			}
		// 		});
		// 		return active;
		// 	});
	}


	//only for ticket-index
	actionOccupationMap({
		organization,
		device_type
	}) {
		return Promise.resolve(WorkstationCache.findByFilter(organization))
			.then((res) => {
				let occupation_map = {},
					l = res.length;
				while (l--) {
					if (res[l] && res[l].get("occupied_by")
						.length > 0)
						occupation_map[res[l].id] = res[l].get("occupied_by");
				}
				return occupation_map;
			});
	}

	_findSingleWorkstation(id) {
		let ws = WorkstationCache.find(id);
		return ws ? Promise.resolve(ws) : this.patchwerk.get("Shapeshifter", {
			key: id
		});
	}

	_findWorkstations(ids) {
		return Promise.map(_.castArray(ids), id => {
			return WorkstationCache.find(id) || this.patchwerk.get("Shapeshifter", {
				key: id
			});
		});
	}


	actionOccupy({
		workstation,
		user_id,
		user_type
	}) {
		let ws;
		console.log("WS OCC", workstation, user_id, user_type);
		return this._findSingleWorkstation(workstation)
			.then((res) => {
				console.log("ws entry", res);
				ws = res;
				if (!ws || !ws.get("attached_to"))
					return Promise.reject(new Error("No such workstations."));
				ws.occupy(user_id);
				return this.patchwerk.save(ws, ws.creation_params);
			})
			.then(res => {
				console.log("ws entry", res);
				return this.emitter.addTask('agent', {
					_action: 'login',
					user_id,
					user_type,
					workstation
				});
			})
			.then((res) => {
				console.log("ws login");

				if (!res.success)
					return Promise.reject(new Error("Failed to login user."));
				this.emitter.emit("workstation.emit.change-state", {
					user_id,
					workstation,
					organization: ws.get("attached_to")
				});
				return {
					workstation: ws.serialize()
				};
			});
	}


	actionUserLogout({
		user_id: administrator,
		target: workstation,
		workstation: adm_workstation
	}) {
		let to_logout_ws;
		let org, user_id;
		return this._findSingleWorkstation(workstation)
			.then((ws) => {
				// console.log(ws);
				user_id = ws.get("occupied_by")[0];
				let organization = ws.get("attached_to");

				return this.emitter.addTask('workstation', {
						_action: 'organization-data',
						organization: organization
					})
					.then(res => res[organization]);
			})
			.then((pre) => {
				org = pre;
				to_logout_ws = WorkstationCache.findByFilter(org.org_merged.id, (ws) => ws.occupiedBy(user_id));
				return Promise.map(to_logout_ws, (ws) => {
					return this.emitter.addTask('queue', {
						_action: "clear-agent",
						administrator_id: administrator,
						administrator_ws: adm_workstation,
						user_id: user_id,
						workstation: ws.id
					});
				});
			})
			.then(res => {
				console.log("afterclear", res);
				_.forEach(to_logout_ws, (ws) => {
					let to_join = ['command.logout', org.org_addr, ws.id];
					this.emitter.emit('broadcast', {
						event: _.join(to_join, ".")
					});
				});
				// console.log("LEAVING II", to_logout_ws);
				_.forEach(to_logout_ws, (ws, key) => ws.deoccupy(user_id));
				// console.log("LEAVING II", to_put);
				return Promise.map(to_logout_ws, w => this.patchwerk.save(w, w.creation_params));
			})
			.then((res) => {
				this.emitter.emit("workstation.emit.change-state", {
					user_id,
					workstation,
					organization: org.org_merged.id
				});
				return this.emitter.addTask('agent', {
					_action: 'logout',
					user_id
				});
			});
	}


	actionLeave({
		user_id,
		workstation
	}) {
		let fin;
		let ws, orgs = {};
		console.log("LEAVE", user_id, workstation);
		return this._findWorkstations(workstation)
			.then((res) => {
				ws = res;
				let l = ws.length;
				console.log("LEAVING", ws);
				while (l--) {
					ws[l].deoccupy(user_id);
					orgs[ws[l].get("attached_to")] = true;
				}
				orgs = Object.keys(orgs);
				return Promise.map(ws, w => this.patchwerk.save(w, w.creation_params));
			})
			.then((res) => {
				console.log("LEFT WS", res);

				this.emitter.emit("workstation.emit.change-state", {
					user_id,
					workstation,
					organization: orgs
				});

				return Promise.map(res, (ws_obj) => {
					return this.emitter.addTask('queue', {
						_action: "clear-agent-queue",
						operator: user_id,
						workstation: ws_obj.id
					});
				});
			})
			.then(res => {
				return this.actionByAgent({
					user_id: user_id,
					organization: orgs
				});
			})
			.then((res) => {
				// console.log(res);
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


	actionChangeState({
		user_id,
		workstation,
		state
	}) {
		console.log(workstation);
		let fin, orgs = {};
		return this._findWorkstations(workstation)
			.then((res) => {
				let workstations = res,
					l = workstations.length;
				while (l--) {
					workstations[l].set("state", state);
					orgs[workstations[l].get("attached_to")] = true;
				}
				orgs = Object.keys(orgs);
				return Promise.map(workstations, w => this.patchwerk.save(w, w.creation_params));
			})
			.then((res) => {
				this.emitter.emit("workstation.emit.change-state", {
					user_id,
					workstation,
					organization: orgs
				});

				return Promise.map(res, (ws_obj) => {
					return this.emitter.addTask('queue', {
						_action: "clear-agent-queue",
						operator: user_id,
						workstation: ws_obj.id
					});
				});
			})
			.then((res) => {
				// console.log("USER CHSTATE", user_id, res);
				global.logger && logger.info("Workstation %s changes state to %s", workstation, state);
				return {
					success: true
				};
			});
	}
}

module.exports = Workstation;