import type { Env, LineWebhookBody, LineEvent, VideoMetadata } from "../types";
import { verifyLineSignature } from "../lib/line/signature";
import { getMessageContent } from "../lib/line/client";
import { saveVideo } from "../lib/storage";

export async function handleWebhook(
	request: Request,
	env: Env
): Promise<Response> {
	if (request.method !== "POST") {
		return new Response("Method not allowed", { status: 405 });
	}

	console.log(`Received ${request.method} request to /api/webhook`);

	const signature = request.headers.get("x-line-signature");
	if (!signature) {
		console.warn("Missing x-line-signature header");
		return new Response("Missing signature", { status: 400 });
	}

	const body = await request.text();

	const isValid = await verifyLineSignature(
		body,
		signature,
		env.LINE_CHANNEL_SECRET
	);

	if (!isValid) {
		console.warn("Invalid LINE signature");
		return new Response("Invalid signature", { status: 401 });
	}

	console.log("Signature validated successfully");
	const webhookBody: LineWebhookBody = JSON.parse(body);

	// Process events asynchronously
	const videoEvents = webhookBody.events.filter(
		(event) => event.type === "message" && event.message?.type === "video"
	);

	for (const event of videoEvents) {
		await processVideoMessage(event, env);
	}

	// Always respond 200 OK to LINE
	return new Response("OK", { status: 200 });
}

async function processVideoMessage(event: LineEvent, env: Env): Promise<void> {
	const messageId = event.message?.id;
	if (!messageId) {
		console.error("No message ID found in event");
		return;
	}

	try {
		const { content, contentType } = await getMessageContent(
			messageId,
			env.LINE_CHANNEL_ACCESS_TOKEN
		);

		const videoId = crypto.randomUUID();
		const metadata: VideoMetadata = {
			id: videoId,
			lineMessageId: messageId,
			sourceUserId: event.source.userId,
			uploadedAt: new Date().toISOString(),
			contentType,
			size: content.byteLength,
		};

		await saveVideo(env.VIDEO_BUCKET, videoId, content, metadata);

		console.log(`Video saved: ${videoId} (${content.byteLength} bytes)`);
	} catch (error) {
		console.error(`Failed to process video message ${messageId}:`, error);
	}
}
