import type { Env } from "./types";
import { handleWebhook } from "./routes/webhook";
import { handleAdmin } from "./routes/admin";
import { handleGetVideo } from "./routes/videos";
import { handleVoiceConvert } from "./routes/voice-convert";
import appHtml from "./routes/app.html";

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// App page (GET /)
		if (path === "/" && request.method === "GET") {
			return new Response(appHtml, {
				headers: {
					"Content-Type": "text/html; charset=utf-8",
				},
			});
		}

		// Admin page (GET /old)
		if (path === "/old" && request.method === "GET") {
			return handleAdmin(request, env);
		}

		// LINE Webhook (POST /api/webhook)
		if (path === "/api/webhook") {
			return handleWebhook(request, env);
		}

		// Video delivery (GET /api/videos/:id)
		const videoMatch = path.match(/^\/api\/videos\/([a-f0-9-]+)$/);
		if (videoMatch && request.method === "GET") {
			return handleGetVideo(request, env, videoMatch[1]);
		}

		// Voice conversion API (/api/voice-convert/*)
		if (path.startsWith("/api/voice-convert")) {
			return handleVoiceConvert(request, env, path);
		}

		return new Response("Not Found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
