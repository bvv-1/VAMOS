// Environment bindings
export interface Env {
	VIDEO_BUCKET: R2Bucket;
	LINE_CHANNEL_SECRET: string;
	LINE_CHANNEL_ACCESS_TOKEN: string;
	BASIC_USERNAME: string;
	BASIC_PASSWORD: string;
	ADMIN_REALM: string;
	// Voice conversion
	ELEVENLABS_API_KEY: string;
	GOOGLE_CLOUD_CREDENTIALS: string; // Base64エンコードされたサービスアカウントJSON
	GOOGLE_CLOUD_PROJECT_ID: string;
}

// Voice conversion types
export interface VoiceInfo {
	voice_id: string;
	name: string;
	preview_url?: string;
	labels?: Record<string, string>;
}

export interface WordTimestamp {
	word: string;
	startTime: number;
	endTime: number;
}

export interface STTResult {
	transcript: string;
	words: WordTimestamp[];
}

export interface TTSResult {
	audioBase64: string;
	actualDurationMs: number;
}

export interface VoiceConvertMode1Request {
	audio: ArrayBuffer;
	voiceId: string;
}

export interface VoiceConvertMode2STTRequest {
	audio: ArrayBuffer;
	language: string;
}

export interface VoiceConvertMode2TTSRequest {
	text: string;
	voiceId: string;
	targetDurationMs?: number;
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
