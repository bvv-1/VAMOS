import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("VAMOS LINE Bot", () => {
	describe("Admin page (GET /)", () => {
		it("returns 401 without authentication", async () => {
			const response = await SELF.fetch("https://example.com/");
			expect(response.status).toBe(401);
			expect(response.headers.get("WWW-Authenticate")).toContain("Basic");
		});

		it("returns admin page with valid authentication", async () => {
			const credentials = btoa("admin:password");
			const response = await SELF.fetch("https://example.com/", {
				headers: {
					Authorization: `Basic ${credentials}`,
				},
			});
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain("Soccer Analysis Pro");
		});

		it("returns 401 with invalid credentials", async () => {
			const credentials = btoa("wrong:credentials");
			const response = await SELF.fetch("https://example.com/", {
				headers: {
					Authorization: `Basic ${credentials}`,
				},
			});
			expect(response.status).toBe(401);
		});
	});

	describe("Webhook (POST /api/webhook)", () => {
		it("returns 400 without signature header", async () => {
			const response = await SELF.fetch("https://example.com/api/webhook", {
				method: "POST",
				body: JSON.stringify({ events: [] }),
			});
			expect(response.status).toBe(400);
		});

		it("returns 401 with invalid signature", async () => {
			const response = await SELF.fetch("https://example.com/api/webhook", {
				method: "POST",
				headers: {
					"x-line-signature": "invalid-signature",
				},
				body: JSON.stringify({ events: [] }),
			});
			expect(response.status).toBe(401);
		});

		it("returns 405 for non-POST requests", async () => {
			const response = await SELF.fetch("https://example.com/api/webhook", {
				method: "GET",
			});
			expect(response.status).toBe(405);
		});
	});

	describe("Video delivery (GET /api/videos/:id)", () => {
		it("returns 404 for non-existent video", async () => {
			const response = await SELF.fetch(
				"https://example.com/api/videos/00000000-0000-0000-0000-000000000000"
			);
			expect(response.status).toBe(404);
		});
	});

	describe("404 handling", () => {
		it("returns 404 for unknown paths", async () => {
			const response = await SELF.fetch("https://example.com/unknown");
			expect(response.status).toBe(404);
		});
	});

	describe("Voice conversion ( /api/voice-convert/*)", () => {
		it("returns 404 for unknown sub-paths", async () => {
			const response = await SELF.fetch(
				"https://example.com/api/voice-convert/unknown"
			);
			expect(response.status).toBe(404);
		});

		it("responds to OPTIONS requests (CORS)", async () => {
			const response = await SELF.fetch(
				"https://example.com/api/voice-convert/voices",
				{
					method: "OPTIONS",
				}
			);
			expect(response.status).toBe(200);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
		});
	});
});
