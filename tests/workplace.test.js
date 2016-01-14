'use strict'

let Workplace = require("./Workplace/workplace");
let config = require("./config/db_config.json");

describe("Workplace service", () => {
	let service = null;
	let bucket = null;
	before(() => {
		service = new Workplace();
		service.init({
			bucket: config.buckets.main
		});
	});

	describe("Workplace service", () => {
		it("should get type", (done) => {
			return service.actionType()
				.then((res) => {
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
		it("should get wp by id", (done) => {
			return service.actionById({
					data: {
						workplace: "iris://data#pc-1"
					}
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
					data: {
						operator: "human-1"
					}
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
			return service.actionWorkplace({
					data: {
						query: {
							device_of: "iris://data#human-1"
						}
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
					data: {
						operator: "iris://data#human-1",
						workplace: "pc-1"
					}
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