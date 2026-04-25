import type { STTResult, TTSResult } from "../../types";

interface ServiceAccountCredentials {
	type: string;
	project_id: string;
	private_key_id: string;
	private_key: string;
	client_email: string;
	client_id: string;
	auth_uri: string;
	token_uri: string;
}

export class GoogleCloudClient {
	private credentials: ServiceAccountCredentials;
	private projectId: string;
	private accessToken: string | null = null;
	private tokenExpiry: number = 0;

	constructor(credentialsBase64: string, projectId: string) {
		if (!credentialsBase64) {
			throw new Error(
				"GOOGLE_CLOUD_CREDENTIALS is missing. Please set it using 'wrangler secret put GOOGLE_CLOUD_CREDENTIALS < service-account.json'."
			);
		}

		const trimmed = credentialsBase64.trim();

		try {
			// 直接JSONとしてパースを試みる
			this.credentials = JSON.parse(trimmed) as ServiceAccountCredentials;
		} catch (e) {
			throw new Error(
				`GOOGLE_CLOUD_CREDENTIALS JSON error: ${
					e instanceof Error ? e.message : "Unknown error"
				}. Ensure the secret is the raw JSON content of your Service Account key file (starts with "{").`
			);
		}
		this.projectId = projectId;
	}

	/**
	 * JWTを生成してアクセストークンを取得
	 */
	private async getAccessToken(): Promise<string> {
		const now = Math.floor(Date.now() / 1000);

		// トークンが有効期限内なら再利用
		if (this.accessToken && this.tokenExpiry > now + 60) {
			return this.accessToken;
		}

		const header = {
			alg: "RS256",
			typ: "JWT",
		};

		const payload = {
			iss: this.credentials.client_email,
			scope: "https://www.googleapis.com/auth/cloud-platform",
			aud: "https://oauth2.googleapis.com/token",
			exp: now + 3600,
			iat: now,
		};

		const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
		const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
		const signatureInput = `${encodedHeader}.${encodedPayload}`;

		const signature = await this.signWithRSA(
			signatureInput,
			this.credentials.private_key
		);
		const jwt = `${signatureInput}.${signature}`;

		// トークンエンドポイントでアクセストークンを取得
		const response = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
				assertion: jwt,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Google OAuth error: ${response.status} - ${errorText}`);
		}

		const data = (await response.json()) as {
			access_token: string;
			expires_in: number;
		};
		this.accessToken = data.access_token;
		this.tokenExpiry = now + data.expires_in;

		return this.accessToken;
	}

	private base64UrlEncode(str: string): string {
		const bytes = new TextEncoder().encode(str);
		const base64 = btoa(String.fromCharCode(...bytes));
		return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	}

	private async signWithRSA(data: string, privateKeyPem: string): Promise<string> {
		// PEM形式の秘密鍵をCryptoKey形式に変換
		// ヘッダー、フッター、改行、空白をすべて除去
		const pemContent = privateKeyPem
			.replace(/-----BEGIN [A-Z ]+-----/g, "")
			.replace(/-----END [A-Z ]+-----/g, "")
			.replace(/\s/g, "");

		const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

		const cryptoKey = await crypto.subtle.importKey(
			"pkcs8",
			binaryKey,
			{
				name: "RSASSA-PKCS1-v1_5",
				hash: "SHA-256",
			},
			false,
			["sign"]
		);

		const dataBytes = new TextEncoder().encode(data);
		const signature = await crypto.subtle.sign(
			"RSASSA-PKCS1-v1_5",
			cryptoKey,
			dataBytes
		);

		const signatureArray = new Uint8Array(signature);
		const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
		return signatureBase64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	}

	/**
	 * Speech-to-Text API (Chirp 3) - word-level timestamps対応
	 */
	async speechToText(
		audioData: ArrayBuffer,
		languageCode: string = "ja-JP"
	): Promise<STTResult> {
		const accessToken = await this.getAccessToken();

		// 大きなデータのbtoaでのスタックオーバーフローを避けるためにチャンク処理
		const uint8Array = new Uint8Array(audioData);
		let binary = "";
		const chunkSize = 8192;
		for (let i = 0; i < uint8Array.length; i += chunkSize) {
			binary += String.fromCharCode.apply(
				null,
				Array.from(uint8Array.subarray(i, i + chunkSize))
			);
		}
		const audioBase64 = btoa(binary);

		// Speech-to-Text V2 API (Chirp 2)
		const location = "asia-southeast1";
		const recognizer = `projects/${this.projectId}/locations/${location}/recognizers/_`;

		const requestBody = {
			config: {
				model: "chirp_2",
				features: {
					enableWordTimeOffsets: true,
					enableWordConfidence: true,
				},
				autoDecodingConfig: {},
				languageCodes: [languageCode],
			},
			content: audioBase64,
		};

		const response = await fetch(
			`https://${location}-speech.googleapis.com/v2/${recognizer}:recognize`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
					"x-goog-request-params": `recognizer=${recognizer}`,
				},
				body: JSON.stringify(requestBody),
			}
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Google STT error: ${response.status} - ${errorText}`);
		}

		const data = (await response.json()) as {
			results?: Array<{
				alternatives?: Array<{
					transcript?: string;
					words?: Array<{
						word?: string;
						startOffset?: string;
						endOffset?: string;
					}>;
				}>;
			}>;
		};

		// 結果をパース
		let transcript = "";
		const words: STTResult["words"] = [];

		if (data.results) {
			for (const result of data.results) {
				if (result.alternatives && result.alternatives.length > 0) {
					const alt = result.alternatives[0];
					transcript += alt.transcript || "";

					if (alt.words) {
						for (const w of alt.words) {
							words.push({
								word: w.word || "",
								startTime: this.parseGoogleDuration(w.startOffset),
								endTime: this.parseGoogleDuration(w.endOffset),
							});
						}
					}
				}
			}
		}

		return { transcript, words };
	}

	private parseGoogleDuration(duration?: string): number {
		if (!duration) return 0;
		// Google APIは "1.5s" や "0s" の形式で返す
		const match = duration.match(/^([\d.]+)s$/);
		if (match) {
			return parseFloat(match[1]);
		}
		return 0;
	}

	/**
	 * Text-to-Speech API (Chirp 3) - バックアップ用
	 */
	async textToSpeech(
		text: string,
		languageCode: string = "ja-JP",
		voiceName?: string
	): Promise<TTSResult> {
		const accessToken = await this.getAccessToken();

		// Chirp 3音声の選択（日本語対応）
		const voice = voiceName || "ja-JP-Chirp3-HD-Aoede";

		// SSMLを使用して正確な終了時間を取得するためのマークを挿入
		const ssml = `<speak>${text}<mark name="end"/></speak>`;

		const requestBody = {
			input: { ssml },
			voice: {
				languageCode,
				name: voice,
			},
			audioConfig: {
				audioEncoding: "LINEAR16",
				sampleRateHertz: 48000,
				speakingRate: 1.0,
				pitch: 0.0,
			},
			enableTimePointing: ["SSML_MARK"],
		};

		const response = await fetch(
			`https://texttospeech.googleapis.com/v1beta1/text:synthesize`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(requestBody),
			}
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Google TTS error: ${response.status} - ${errorText}`);
		}

		const data = (await response.json()) as {
			audioContent: string;
			timepoints?: Array<{
				markName: string;
				timeSeconds: number;
			}>;
		};

		// タイムポイントから正確な終了時間を取得
		let actualDurationMs = text.length * 150; // フォールバック
		if (data.timepoints) {
			const endMark = data.timepoints.find((t) => t.markName === "end");
			if (endMark) {
				actualDurationMs = endMark.timeSeconds * 1000;
			}
		}

		return {
			audioBase64: data.audioContent,
			actualDurationMs,
		};
	}

	/**
	 * 利用可能なChirp 3音声一覧を取得
	 */
	async getChirp3Voices(languageCode: string = "ja-JP"): Promise<
		Array<{ name: string; gender: string }>
	> {
		const accessToken = await this.getAccessToken();

		const response = await fetch(
			`https://texttospeech.googleapis.com/v1beta1/voices?languageCode=${languageCode}`,
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		if (!response.ok) {
			throw new Error(`Google TTS voices error: ${response.status}`);
		}

		const data = (await response.json()) as {
			voices?: Array<{
				name: string;
				ssmlGender: string;
			}>;
		};

		// Chirp3音声のみフィルタリング
		const chirp3Voices =
			data.voices?.filter((v) => v.name.includes("Chirp3")) || [];

		return chirp3Voices.map((v) => ({
			name: v.name,
			gender: v.ssmlGender,
		}));
	}
}
