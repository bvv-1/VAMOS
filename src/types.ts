// Environment bindings
export interface Env {
	VIDEO_BUCKET: R2Bucket;
	LINE_CHANNEL_SECRET: string;
	LINE_CHANNEL_ACCESS_TOKEN: string;
	BASIC_USERNAME: string;
	BASIC_PASSWORD: string;
	ADMIN_REALM: string;
}

// LINE Webhook Event Types
export interface LineWebhookBody {
	destination: string;
	events: LineEvent[];
}

export interface LineEvent {
	type: string;
	message?: LineMessage;
	replyToken?: string;
	source: LineSource;
	timestamp: number;
	mode: string;
}

export interface LineMessage {
	type: string;
	id: string;
	duration?: number;
	contentProvider?: {
		type: string;
	};
}

export interface LineSource {
	type: string;
	userId?: string;
	groupId?: string;
	roomId?: string;
}

// Video metadata stored alongside content
export interface VideoMetadata {
	id: string;
	lineMessageId: string;
	sourceUserId?: string;
	uploadedAt: string;
	contentType: string;
	size: number;
}
