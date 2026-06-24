import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import testPrisma from "./setup.js";

// Mock the prisma singleton to use the test client
vi.mock("../../lib/prisma.js", () => ({
	default: testPrisma,
}));

// Import app AFTER mocking prisma
const { default: app } = await import("../../app.js");
import request from "supertest";

describe("Task API E2E Tests", () => {
	beforeEach(async () => {
		// Clean up database between tests
		await testPrisma.task.deleteMany();
	});

	afterAll(async () => {
		await testPrisma.$disconnect();
	});

	describe("POST /api/tasks", () => {
		it("should create a new task", async () => {
			const res = await request(app)
				.post("/api/tasks")
				.send({ title: "E2E Task", description: "E2E Description" });

			expect(res.status).toBe(201);
			expect(res.body).toHaveProperty("id");
			expect(res.body.title).toBe("E2E Task");
			expect(res.body.description).toBe("E2E Description");
			expect(res.body.completed).toBe(false);
		});

		it("should create a task without a description", async () => {
			const res = await request(app)
				.post("/api/tasks")
				.send({ title: "No description" });

			expect(res.status).toBe(201);
			expect(res.body.title).toBe("No description");
			expect(res.body.description).toBeNull();
		});

		it("should trim the title", async () => {
			const res = await request(app)
				.post("/api/tasks")
				.send({ title: "  Trimmed  " });

			expect(res.status).toBe(201);
			expect(res.body.title).toBe("Trimmed");
		});

		it("should return 400 when the title is missing", async () => {
			const res = await request(app).post("/api/tasks").send({});

			expect(res.status).toBe(400);
			expect(res.body).toHaveProperty("error");
		});

		it("should return 400 when the title is empty", async () => {
			const res = await request(app)
				.post("/api/tasks")
				.send({ title: "   " });

			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/tasks", () => {
		it("should return an empty list when there are no tasks", async () => {
			const res = await request(app).get("/api/tasks");

			expect(res.status).toBe(200);
			expect(res.body).toEqual([]);
		});

		it("should return all tasks ordered by createdAt desc", async () => {
			await testPrisma.task.create({ data: { title: "First" } });
			await testPrisma.task.create({ data: { title: "Second" } });

			const res = await request(app).get("/api/tasks");

			expect(res.status).toBe(200);
			expect(res.body).toHaveLength(2);
			expect(res.body[0].title).toBe("Second");
			expect(res.body[1].title).toBe("First");
		});
	});

	describe("GET /api/tasks/:id", () => {
		it("should return a task by id", async () => {
			const created = await testPrisma.task.create({
				data: { title: "Find me" },
			});

			const res = await request(app).get(`/api/tasks/${created.id}`);

			expect(res.status).toBe(200);
			expect(res.body.id).toBe(created.id);
			expect(res.body.title).toBe("Find me");
		});

		it("should return 400 for an invalid id", async () => {
			const res = await request(app).get("/api/tasks/abc");

			expect(res.status).toBe(400);
			expect(res.body).toHaveProperty("error");
		});

		it("should return 404 when the task does not exist", async () => {
			const res = await request(app).get("/api/tasks/99999");

			expect(res.status).toBe(404);
			expect(res.body).toHaveProperty("error");
		});
	});

	describe("PUT /api/tasks/:id", () => {
		it("should update an existing task", async () => {
			const created = await testPrisma.task.create({
				data: { title: "Old title" },
			});

			const res = await request(app)
				.put(`/api/tasks/${created.id}`)
				.send({ title: "New title", completed: true });

			expect(res.status).toBe(200);
			expect(res.body.title).toBe("New title");
			expect(res.body.completed).toBe(true);
		});

		it("should return 400 for an invalid id", async () => {
			const res = await request(app)
				.put("/api/tasks/abc")
				.send({ title: "x" });

			expect(res.status).toBe(400);
		});

		it("should return 404 when the task does not exist", async () => {
			const res = await request(app)
				.put("/api/tasks/99999")
				.send({ title: "x" });

			expect(res.status).toBe(404);
			expect(res.body).toHaveProperty("error");
		});
	});

	describe("DELETE /api/tasks/:id", () => {
		it("should delete an existing task", async () => {
			const created = await testPrisma.task.create({
				data: { title: "To delete" },
			});

			const res = await request(app).delete(`/api/tasks/${created.id}`);

			expect(res.status).toBe(204);

			const found = await testPrisma.task.findUnique({
				where: { id: created.id },
			});
			expect(found).toBeNull();
		});

		it("should return 400 for an invalid id", async () => {
			const res = await request(app).delete("/api/tasks/abc");

			expect(res.status).toBe(400);
		});

		it("should return 404 when the task does not exist", async () => {
			const res = await request(app).delete("/api/tasks/99999");

			expect(res.status).toBe(404);
			expect(res.body).toHaveProperty("error");
		});
	});
});
