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
				return this.actionScheduleLogoutAll({
					organization: _.map(res, '@id')
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


	actionResourceKeys({
		organization,
		state = ['active'],
		device_type
	}) {
		return this.actionGetWorkstationsCache({
				organization,
				device_type
			})
			.then((res) => {
				let active = [];
				let all = _.flatMap(res, (v, dt) => {
					return _.map(v, (vv) => {
						if (state === '*' || !!~state.indexOf(vv.state)) {
							active.push(vv.id);
						}
						return vv.id;
					});
				});
				return {
					all: all,
					active: active
				};
			});
	}

	actionProviders({
		organization,
		state = ['active'],
		device_type
	}) {
		return this.actionGetWorkstationsCache({
				organization,
				device_type
			})
			.then((res) => {
				let active = {},
					l;
				_.map(res, (v) => {
					l = v.length;
					while (l--) {
						if (state === '*' || !!~state.indexOf(v[l].state)) {
							active[v[l].id] = v[l];
						}
					}
				});
				return active;
			});
	}


	actionOccupationMap({
		organization,
		device_type
	}) {
		return this.actionGetWorkstationsCache({
				organization,
				device_type
			})
			.then((res) => {
				let occupation_map = {},
					l;
				_.map(res, (v) => {
					l = v.length;
					while (l--) {
						if (v[l] && v[l].occupied_by.length > 0)
							occupation_map[v[l].id] = v[l].occupied_by;
					}
				});
				return occupation_map;
			});
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
				console.log("ws entry");
				ws = res[workstation];
				if (!ws)
					return Promise.reject(new Error("No such workstations."));
				let occupation = ws.occupied_by || [];
				occupation = _.castArray(occupation);
				if (ws.device_type == 'control-panel') {
					if (!_.isEmpty(occupation) && !~_.indexOf(occupation, user_id))
						return Promise.reject(new Error(`Workstation ${workstation} is already occupied by agents ${occupation}.`));
				}
				ws.occupied_by = _.uniq(_.concat(occupation, user_id));
				ws.state = 'active';
				return this.iris.setEntryTypeless(ws);
			})
			.then(res => {
				console.log("ws set cache");

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
				return {
					workstation: ws
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
		return this.emitter.addTask("workstation", {
				_action: "by-id",
				workstation: workstation
			})
			.then((res) => {
				let ws = res[workstation];
				console.log(ws);
				user_id = ws.occupied_by[0];
				let organization = ws.attached_to;

				return Promise.props({
					ws: this.emitter.addTask('workstation', {
						_action: "by-agent",
						user_id: user_id,
						organization: organization
					}),
					org: this.emitter.addTask('workstation', {
							_action: 'workstation-organization-data',
							workstation: workstation
						})
						.then(res => res[workstation])
				});
			})
			.then((res) => {
				org = res.org;
				to_logout_ws = res.ws['control-panel'];
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
				_.map(to_logout_ws, (ws) => {
					let to_join = ['command.logout', org.org_addr, ws.id];
					this.emitter.emit('broadcast', {
						event: _.join(to_join, ".")
					});
				});
				// console.log("LEAVING II", to_logout_ws);
				let to_put = _.map(to_logout_ws, (ws, key) => {
					let occupation = _.castArray(ws.occupied_by);
					ws.occupied_by = _.uniq(_.filter(occupation, (usr) => (usr !== user_id)));
					if (_.isEmpty(ws.occupied_by))
						ws.state = 'inactive';
					return ws;
				});
				// console.log("LEAVING II", to_put);
				return this.iris.setEntryTypeless(to_put);
			})
			.then((res) => {
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
		let ws;
		console.log("LEAVE", user_id, workstation);
		return this.iris.getEntryTypeless(workstation)
			.then((res) => {
				ws = res;
				let to_put = _.map(res, (ws, key) => {
					let occupation = _.castArray(ws.occupied_by);
					ws.occupied_by = _.uniq(_.filter(occupation, (user) => (user !== user_id)));
					if (_.isEmpty(ws.occupied_by))
						ws.state = 'inactive';
					return ws;
				});
				return this.iris.setEntryTypeless(to_put);
			})
			.then((res) => {
				console.log("LEAVE WS", res);
				fin = _.mapValues(res, val => !!val.cas);

				return Promise.all(_.map(fin, (ws_res, ws_key) => {
					if (!ws_res)
						return {
							success: ws_res
						};
					return this.emitter.addTask('queue', {
						_action: "clear-agent-queue",
						operator: user_id,
						workstation: ws_key
					});
				}));
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
				console.log(res);
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
		let orgs = [];
		let fin;
		return this.iris.getEntryTypeless(workstation)
			.then((res) => {
				let ws = _(res)
					.values()
					.compact()
					.map(a => {
						a.state = state;
						if (!~_.indexOf(orgs, a.attached_to))
							orgs.push(a.attached_to);
						return a;
					})
					.value();
				return this.iris.setEntryTypeless(ws);
			})
			.then((res) => {
				fin = _.mapValues(res, val => !!val.cas);

				return Promise.all(_.map(fin, (ws_res, ws_key) => {
					if (!ws_res || state == 'active')
						return {
							success: ws_res
						};
					return this.emitter.addTask('queue', {
						_action: "clear-agent-queue",
						operator: user_id,
						workstation: ws_key
					});
				}));
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