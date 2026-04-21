import type { Env } from "../types";

export function createUnauthorizedResponse(realm: string): Response {
	return new Response("Unauthorized", {
		status: 401,
		headers: {
			"WWW-Authenticate": `Basic realm="${realm}"`,
		},
	});
}

export function verifyBasicAuth(request: Request, env: Env): boolean {
	const authHeader = request.headers.get("Authorization");
	if (!authHeader || !authHeader.startsWith("Basic ")) {
		return false;
	}

	const base64Credentials = authHeader.slice(6);
	let credentials: string;
	try {
		credentials = atob(base64Credentials);
	} catch {
		return false;
	}

	const colonIndex = credentials.indexOf(":");
	if (colonIndex === -1) {
		return false;
	}

	const username = credentials.slice(0, colonIndex);
	const password = credentials.slice(colonIndex + 1);

	return username === env.BASIC_USERNAME && password === env.BASIC_PASSWORD;
}
