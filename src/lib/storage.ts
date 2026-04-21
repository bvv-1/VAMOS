import type { VideoMetadata } from "../types";

export async function saveVideo(
	bucket: R2Bucket,
	id: string,
	content: ArrayBuffer,
	metadata: VideoMetadata
): Promise<void> {
	await bucket.put(`videos/${id}`, content, {
		httpMetadata: {
			contentType: metadata.contentType,
		},
		customMetadata: {
			lineMessageId: metadata.lineMessageId,
			sourceUserId: metadata.sourceUserId || "",
			uploadedAt: metadata.uploadedAt,
		},
	});
}

export async function getVideo(
	bucket: R2Bucket,
	id: string
): Promise<R2ObjectBody | null> {
	return bucket.get(`videos/${id}`);
}

export async function listVideos(
	bucket: R2Bucket,
	limit = 100
): Promise<R2Objects> {
	return bucket.list({
		prefix: "videos/",
		limit,
	});
}
