import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
 
export default defineWorkersConfig({
	plugins: [react(), cloudflare(), viteSingleFile()],
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
			},
		},
	},
	build: {
		minify: false
  	}
});
