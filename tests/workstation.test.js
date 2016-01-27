'use strict'

let Workstation = require("./Workstation/workstation");
let config = require("./config/db_config.json");

describe("Workstation service", () => {
	let service = null;
	let bucket = null;
	before(() => {
		service = new Workstation();
		service.init();
	});

	describe("Workstation service", () => {
		it("should get type", (done) => {
			return service.actionType({
					workstation: "iris://data#pc-1"
				})
				.then((res) => {
					expect(res).to.have.property("iris://data#pc-1", 'control-panel');
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
		it("should get wp by id", (done) => {
			return service.actionById({
					workstation: "iris://data#pc-1"
				})
				.then((res) => {
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
		it("should get wp by operator", (done) => {
			return service.actionByOperator({
					operator: "human-1"
				})
				.then((res) => {
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
		it("should get wp availability", (done) => {
			return service.actionAvailable()
				.then((res) => {
					console.log(res);
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
		it("should pass cmd", (done) => {
			return service.actionExecuteCommand()
				.then((res) => {
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
		it("should get  wp by query", (done) => {
			return service.actionWorkstation({
					query: {
						default_agent: "iris://data#human-1"
					}
				})
				.then((res) => {
					console.log(res);
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
		it("should occupy wp", (done) => {
			return service.actionOccupy({
					user_id: "iris://data#human-1",
					workstation: "pc-1"
				})
				.then((res) => {
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
		it("should supervise wp", (done) => {
			return service.actionSupervise()
				.then((res) => {
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
	})

});