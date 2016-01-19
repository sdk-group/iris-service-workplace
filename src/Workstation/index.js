let events = {
	workstation: {
		// get_type: "workstation.get_type",
		// get_by_id: "workstation.get_by_id",
		// get_by_operator: "workstation.get_by_operator",
		// get_available: "workstation.get_available",
		// execute_command: "workstation.execute_command",
		// get_workstation: "workstation.get_workstation",
		// occupy: "workstation.occupy",
		// supervise: "workstation.supervise"
	}
}

let tasks = [
	// 	{
	// 	name: events.workstation.get_type,
	// 	handler: 'getType'
	// }, {
	// 	name: events.workstation.get_by_id,
	// 	handler: 'getById'
	// }, {
	// 	name: events.workstation.get_by_operator,
	// 	handler: 'getByOperator'
	// }, {
	// 	name: events.workstation.get_available,
	// 	handler: 'getAvailable'
	// }, {
	// 	name: events.workstation.execute_command,
	// 	handler: 'executeCommand'
	// }, {
	// 	name: events.workstation.get_workstation,
	// 	handler: 'getWorkstation'
	// }, {
	// 	name: events.workstation.occupy,
	// 	handler: 'occupy'
	// }, {
	// 	name: events.workstation.supervise,
	// 	handler: 'supervise'
	// }
]


module.exports = {
	module: require('./workstation.js'),
	permissions: [],
	exposed: true,
	tasks: tasks,
	events: {
		group: 'workstation',
		shorthands: events.workstation
	}
};