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

	describe("POST /api/voice-convert/mode2/tts (ElevenLabs TTS)", () => {
		const TTS_URL = "https://example.com/api/voice-convert/mode2/tts";

		it("responds to CORS preflight", async ({ expect }) => {
			const response = await SELF.fetch(TTS_URL, { method: "OPTIONS" });
			expect(response.status).toBe(200);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
			expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
				"POST"
			);
		});

		it("returns 400 when text is missing", async ({ expect }) => {
			const response = await SELF.fetch(TTS_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ voice_id: "test-voice-id" }),
			});
			expect(response.status).toBe(400);
			const body = (await response.json()) as { error: string };
			expect(body.error).toContain("text");
		});

		it("returns 400 when voice_id is missing", async ({ expect }) => {
			const response = await SELF.fetch(TTS_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: "こんにちは" }),
			});
			expect(response.status).toBe(400);
			const body = (await response.json()) as { error: string };
			expect(body.error).toContain("voice_id");
		});

		it("returns 400 when body is empty", async ({ expect }) => {
			const response = await SELF.fetch(TTS_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});
			expect(response.status).toBe(400);
			const body = (await response.json()) as { error: string };
			expect(body.error).toBeDefined();
		});

		it("returns audio and duration on success", async ({ expect }) => {
			const mockAudioBase64 = "bW9ja2F1ZGlv";
			const mockResponse = {
				audio_base64: mockAudioBase64,
				alignment: {
					characters: ["h", "i"],
					character_start_times_seconds: [0, 0.5],
					character_end_times_seconds: [0.5, 1.2],
				},
			};

			const originalFetch = globalThis.fetch;
			globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = typeof input === "string" ? input : input.toString();
				if (url.includes("api.elevenlabs.io")) {
					return new Response(JSON.stringify(mockResponse), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				return originalFetch(input, init);
			};

			try {
				const response = await SELF.fetch(TTS_URL, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						text: "こんにちは",
						voice_id: "test-voice-id",
					}),
				});
				expect(response.status).toBe(200);
				const body = (await response.json()) as {
					audio_base64: string;
					actual_duration_ms: number;
				};
				expect(body.audio_base64).toBe(mockAudioBase64);
				expect(body.actual_duration_ms).toBe(1200);
			} finally {
				globalThis.fetch = originalFetch;
			}
		});

		it("passes target_duration_ms to the client", async ({ expect }) => {
			let capturedBody: unknown;
			const originalFetch = globalThis.fetch;
			globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = typeof input === "string" ? input : input.toString();
				if (url.includes("api.elevenlabs.io")) {
					capturedBody = JSON.parse((init?.body as string) ?? "{}");
					return new Response(
						JSON.stringify({
							audio_base64: "dGVzdA==",
							alignment: {
								characters: ["a"],
								character_start_times_seconds: [0],
								character_end_times_seconds: [0.5],
							},
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						}
					);
				}
				return originalFetch(input, init);
			};

			try {
				await SELF.fetch(TTS_URL, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						text: "テスト",
						voice_id: "test-voice-id",
						target_duration_ms: 3000,
					}),
				});
				expect(capturedBody).toBeDefined();
			} finally {
				globalThis.fetch = originalFetch;
			}
		});

		it("returns 500 when ElevenLabs API returns an error", async ({ expect }) => {
			const originalFetch = globalThis.fetch;
			globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = typeof input === "string" ? input : input.toString();
				if (url.includes("api.elevenlabs.io")) {
					return new Response("Unauthorized", { status: 401 });
				}
				return originalFetch(input, init);
			};

			try {
				const response = await SELF.fetch(TTS_URL, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						text: "こんにちは",
						voice_id: "test-voice-id",
					}),
				});
				expect(response.status).toBe(500);
				const body = (await response.json()) as { error: string };
				expect(body.error).toContain("401");
			} finally {
				globalThis.fetch = originalFetch;
			}
		});
	});
});
