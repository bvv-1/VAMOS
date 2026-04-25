import type { Env } from "../types";
import { ElevenLabsClient } from "../lib/elevenlabs/client";
import { GoogleCloudClient } from "../lib/google-cloud/client";

/**
 * 音声変換APIのメインハンドラー
 */
export async function handleVoiceConvert(
	request: Request,
	env: Env,
	path: string
): Promise<Response> {
	const corsHeaders = {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
	};

	// CORS preflight
	if (request.method === "OPTIONS") {
		return new Response(null, { headers: corsHeaders });
	}

	try {
		// GET /api/voice-convert/voices - ElevenLabs ボイス一覧取得
		if (path === "/api/voice-convert/voices" && request.method === "GET") {
			return await handleGetVoices(env, corsHeaders);
		}

		// GET /api/voice-convert/voices-chirp - Google Cloud Chirp 3 ボイス一覧取得
		if (path === "/api/voice-convert/voices-chirp" && request.method === "GET") {
			return await handleGetChirpVoices(env, corsHeaders);
		}

		// POST /api/voice-convert/mode1 - Voice Changer
		if (path === "/api/voice-convert/mode1" && request.method === "POST") {
			return await handleMode1(request, env, corsHeaders);
		}

		// POST /api/voice-convert/mode2/stt - Speech to Text
		if (path === "/api/voice-convert/mode2/stt" && request.method === "POST") {
			return await handleMode2STT(request, env, corsHeaders);
		}

		// POST /api/voice-convert/mode2/tts-chirp - Google Cloud TTS (Chirp 3)
		if (
			path === "/api/voice-convert/mode2/tts-chirp" &&
			request.method === "POST"
		) {
			return await handleMode2TTSChirp(request, env, corsHeaders);
		}

		return new Response("Not Found", { status: 404, headers: corsHeaders });
	} catch (error) {
		console.error("Voice convert error:", error);
		const message = error instanceof Error ? error.message : "Unknown error";
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
}

/**
 * GET /api/voice-convert/voices
 * 利用可能なボイス一覧を取得
 */
async function handleGetVoices(
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	try {
		const elevenlabs = new ElevenLabsClient(env.ELEVENLABS_API_KEY);
		let voices = await elevenlabs.getVoices();

		// "Ishibashi" を含むボイスを優先的に上へ
		voices.sort((a, b) => {
			const aIsIshibashi = a.name.includes("Ishibashi");
			const bIsIshibashi = b.name.includes("Ishibashi");
			if (aIsIshibashi && !bIsIshibashi) return -1;
			if (!aIsIshibashi && bIsIshibashi) return 1;
			return a.name.localeCompare(b.name);
		});

		return new Response(JSON.stringify({ voices }), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Error in handleGetVoices:", error);
		throw error; // handleVoiceConvert でキャッチされる
	}
}

/**
 * GET /api/voice-convert/voices-chirp
 * Google Cloud Chirp 3 ボイス一覧を取得
 */
async function handleGetChirpVoices(
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	try {
		const googleCloud = new GoogleCloudClient(
			env.GOOGLE_CLOUD_CREDENTIALS,
			env.GOOGLE_CLOUD_PROJECT_ID
		);
		const voices = await googleCloud.getChirp3Voices();
		return new Response(JSON.stringify({ voices }), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Error in handleGetChirpVoices:", error);
		throw error; // handleVoiceConvert でキャッチされる
	}
}

/**
 * POST /api/voice-convert/mode1
 * ElevenLabs Voice Changer (Speech to Speech)
 */
async function handleMode1(
	request: Request,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	const formData = await request.formData();
	const audioFile = formData.get("audio") as File | null;
	const voiceId = formData.get("voice_id") as string | null;

	if (!audioFile || !voiceId) {
		return new Response(
			JSON.stringify({ error: "audio and voice_id are required" }),
			{
				status: 400,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			}
		);
	}

	const audioData = await audioFile.arrayBuffer();
	const elevenlabs = new ElevenLabsClient(env.ELEVENLABS_API_KEY);
	const resultAudio = await elevenlabs.voiceChanger(audioData, voiceId);

	return new Response(resultAudio, {
		headers: {
			...corsHeaders,
			"Content-Type": "audio/mpeg",
			"Content-Disposition": "attachment; filename=converted.mp3",
		},
	});
}

/**
 * POST /api/voice-convert/mode2/stt
 * Google Cloud Speech-to-Text (Chirp 3)
 */
async function handleMode2STT(
	request: Request,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	const formData = await request.formData();
	const audioFile = formData.get("audio") as File | null;
	const language = (formData.get("language") as string) || "ja-JP";

	if (!audioFile) {
		return new Response(JSON.stringify({ error: "audio is required" }), {
			status: 400,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}

	const audioData = await audioFile.arrayBuffer();
	const googleCloud = new GoogleCloudClient(
		env.GOOGLE_CLOUD_CREDENTIALS,
		env.GOOGLE_CLOUD_PROJECT_ID
	);
	const result = await googleCloud.speechToText(audioData, language);

	return new Response(JSON.stringify(result), {
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});
}

/**
 * POST /api/voice-convert/mode2/tts-chirp
 * Google Cloud Text-to-Speech (Chirp 3) - バックアップ
 */
async function handleMode2TTSChirp(
	request: Request,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	const body = (await request.json()) as {
		text: string;
		voice_name?: string;
		language?: string;
	};

	if (!body.text) {
		return new Response(JSON.stringify({ error: "text is required" }), {
			status: 400,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}

	const googleCloud = new GoogleCloudClient(
		env.GOOGLE_CLOUD_CREDENTIALS,
		env.GOOGLE_CLOUD_PROJECT_ID
	);
	const result = await googleCloud.textToSpeech(
		body.text,
		body.language || "ja-JP",
		body.voice_name
	);

	return new Response(
		JSON.stringify({
			audio_base64: result.audioBase64,
			actual_duration_ms: result.actualDurationMs,
		}),
		{
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		}
	);
}
