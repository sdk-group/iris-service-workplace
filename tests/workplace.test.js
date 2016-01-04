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
			return service.getType()
				.then((res) => {
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
		it("should get wp by id", (done) => {
			return service.getById()
				.then((res) => {
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
		it("should get wp by operator", (done) => {
			return service.getByOperator()
				.then((res) => {
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
		it("should get wp availability", (done) => {
			return service.getAvailable()
				.then((res) => {
					console.log(res);
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
		it("should pass cmd", (done) => {
			return service.executeCommand()
				.then((res) => {
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
		it("should get  wp by query", (done) => {
			return service.getWorkplace()
				.then((res) => {
					console.log(res);
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
		it("should occupy wp", (done) => {
			return service.occupy()
				.then((res) => {
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
		it("should supervise wp", (done) => {
			return service.supervise()
				.then((res) => {
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
	})

});