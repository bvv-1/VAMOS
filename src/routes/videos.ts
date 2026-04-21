import type { Env } from "../types";
import { getVideo } from "../lib/storage";

export async function handleGetVideo(
	request: Request,
	env: Env,
	videoId: string
): Promise<Response> {
	const video = await getVideo(env.VIDEO_BUCKET, videoId);

	if (!video) {
		return new Response("Video not found", { status: 404 });
	}

	const headers = new Headers();
	headers.set(
		"Content-Type",
		video.httpMetadata?.contentType || "video/mp4"
	);
	headers.set("Content-Length", video.size.toString());
	headers.set("Cache-Control", "public, max-age=31536000");

	return new Response(video.body, { headers });
}
