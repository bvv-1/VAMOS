import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: "./wrangler.jsonc" },
				miniflare: {
					bindings: {
						LINE_CHANNEL_SECRET: "test-channel-secret",
						LINE_CHANNEL_ACCESS_TOKEN: "test-access-token",
						BASIC_USERNAME: "admin",
						BASIC_PASSWORD: "password",
					},
				},
			},
		},
	},
});
