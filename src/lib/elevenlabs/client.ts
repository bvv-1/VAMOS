import type { VoiceInfo, TTSResult } from "../../types";

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

export class ElevenLabsClient {
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	/**
	 * 利用可能なボイス一覧を取得
	 */
	async getVoices(): Promise<VoiceInfo[]> {
		const response = await fetch(`${ELEVENLABS_API_BASE}/voices`, {
			headers: {
				"xi-api-key": this.apiKey,
			},
		});

		if (!response.ok) {
			throw new Error(`ElevenLabs voices API error: ${response.status}`);
		}

		const data = (await response.json()) as {
			voices: Array<{
				voice_id: string;
				name: string;
				preview_url?: string;
				labels?: Record<string, string>;
			}>;
		};

		return data.voices.map((v) => ({
			voice_id: v.voice_id,
			name: v.name,
			preview_url: v.preview_url,
			labels: v.labels,
		}));
	}

	/**
	 * Voice Changer (Speech to Speech) - モード1
	 * 元の音声のタイミングを保持しながら声を変換
	 */
	async voiceChanger(
		audioData: ArrayBuffer,
		voiceId: string
	): Promise<ArrayBuffer> {
		const formData = new FormData();
		formData.append("audio", new Blob([audioData], { type: "audio/wav" }));
		formData.append("model_id", "eleven_multilingual_sts_v2");

		const response = await fetch(
			`${ELEVENLABS_API_BASE}/speech-to-speech/${voiceId}`,
			{
				method: "POST",
				headers: {
					"xi-api-key": this.apiKey,
					Accept: "audio/mpeg",
				},
				body: formData,
			}
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`ElevenLabs voice changer error: ${response.status} - ${errorText}`
			);
		}

		return await response.arrayBuffer();
	}

	/**
	 * Text-to-Speech with timing control - モード2
	 * 指定された目標時間に合わせて速度を調整
	 */
	async textToSpeech(
		text: string,
		voiceId: string,
		targetDurationMs?: number
	): Promise<TTSResult> {
		const requestBody: Record<string, unknown> = {
			text,
			model_id: "eleven_multilingual_v2",
			voice_settings: {
				stability: 0.5,
				similarity_boost: 0.75,
				style: 0.0,
				use_speaker_boost: true,
			},
		};

		const response = await fetch(
			`${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}/with-timestamps`,
			{
				method: "POST",
				headers: {
					"xi-api-key": this.apiKey,
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify(requestBody),
			}
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`ElevenLabs TTS error: ${response.status} - ${errorText}`
			);
		}

		const data = (await response.json()) as {
			audio_base64: string;
			alignment?: {
				characters: string[];
				character_start_times_seconds: number[];
				character_end_times_seconds: number[];
			};
		};

		// 生成された音声の実際の長さを計算
		let actualDurationMs = 0;
		if (data.alignment && data.alignment.character_end_times_seconds.length > 0) {
			const endTimes = data.alignment.character_end_times_seconds;
			actualDurationMs = endTimes[endTimes.length - 1] * 1000;
		}

		// 目標時間が指定されている場合、速度調整が必要か確認
		if (targetDurationMs && actualDurationMs > 0) {
			const speedRatio = actualDurationMs / targetDurationMs;
			// 速度差が大きすぎる場合は警告（実際の調整はフロントエンドで行う）
			if (speedRatio < 0.5 || speedRatio > 2.0) {
				console.warn(
					`Speed ratio ${speedRatio} is outside recommended range (0.5-2.0)`
				);
			}
		}

		return {
			audioBase64: data.audio_base64,
			actualDurationMs,
		};
	}

	/**
	 * シンプルなTTS（タイムスタンプなし、ストリーミング向け）
	 */
	async textToSpeechSimple(
		text: string,
		voiceId: string
	): Promise<ArrayBuffer> {
		const response = await fetch(
			`${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`,
			{
				method: "POST",
				headers: {
					"xi-api-key": this.apiKey,
					"Content-Type": "application/json",
					Accept: "audio/mpeg",
				},
				body: JSON.stringify({
					text,
					model_id: "eleven_multilingual_v2",
					voice_settings: {
						stability: 0.5,
						similarity_boost: 0.75,
					},
				}),
			}
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`ElevenLabs TTS error: ${response.status} - ${errorText}`
			);
		}

		return await response.arrayBuffer();
	}
}
