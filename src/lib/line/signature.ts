export async function verifyLineSignature(
	body: string,
	signature: string,
	channelSecret: string
): Promise<boolean> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(channelSecret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);

	const signatureBuffer = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(body)
	);

	const expectedSignature = btoa(
		String.fromCharCode(...new Uint8Array(signatureBuffer))
	);

	return signature === expectedSignature;
}
