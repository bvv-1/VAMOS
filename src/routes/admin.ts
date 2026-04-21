import type { Env } from "../types";
import { verifyBasicAuth, createUnauthorizedResponse } from "../lib/auth";
import adminHtml from "./admin.html";

export function handleAdmin(request: Request, env: Env): Response {
	if (!verifyBasicAuth(request, env)) {
		return createUnauthorizedResponse(env.ADMIN_REALM);
	}

	return new Response(adminHtml, {
		headers: {
			"Content-Type": "text/html; charset=utf-8",
		},
	});
}
