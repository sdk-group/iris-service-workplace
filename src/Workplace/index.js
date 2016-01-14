let events = {
	workplace: {
		// get_type: "workplace.get_type",
		// get_by_id: "workplace.get_by_id",
		// get_by_operator: "workplace.get_by_operator",
		// get_available: "workplace.get_available",
		// execute_command: "workplace.execute_command",
		// get_workplace: "workplace.get_workplace",
		// occupy: "workplace.occupy",
		// supervise: "workplace.supervise"
	}
}

let tasks = [
	// 	{
	// 	name: events.workplace.get_type,
	// 	handler: 'getType'
	// }, {
	// 	name: events.workplace.get_by_id,
	// 	handler: 'getById'
	// }, {
	// 	name: events.workplace.get_by_operator,
	// 	handler: 'getByOperator'
	// }, {
	// 	name: events.workplace.get_available,
	// 	handler: 'getAvailable'
	// }, {
	// 	name: events.workplace.execute_command,
	// 	handler: 'executeCommand'
	// }, {
	// 	name: events.workplace.get_workplace,
	// 	handler: 'getWorkplace'
	// }, {
	// 	name: events.workplace.occupy,
	// 	handler: 'occupy'
	// }, {
	// 	name: events.workplace.supervise,
	// 	handler: 'supervise'
	// }
]


module.exports = {
	module: require('./workplace.js'),
	permissions: [],
	exposed: true,
	tasks: tasks,
	events: {
		group: 'workplace',
		shorthands: events.workplace
	}
};