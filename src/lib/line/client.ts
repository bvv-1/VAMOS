const LINE_API_BASE = "https://api-data.line.me/v2/bot/message";

export interface LineContentResponse {
	content: ArrayBuffer;
	contentType: string;
}

export async function getMessageContent(
	messageId: string,
	accessToken: string
): Promise<LineContentResponse> {
	const response = await fetch(`${LINE_API_BASE}/${messageId}/content`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!response.ok) {
		throw new Error(
			`Failed to get content: ${response.status} ${response.statusText}`
		);
	}

	const content = await response.arrayBuffer();
	const contentType = response.headers.get("Content-Type") || "video/mp4";

	return { content, contentType };
}
