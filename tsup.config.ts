import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    bin: "src/bin.ts",
  },
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  dts: true,
  sourcemap: true,
  splitting: false,
  shims: false,
  banner: { js: "#!/usr/bin/env node" },
  // Only add the shebang to the bin entry — tsup applies banner globally,
  // so we strip it from the library entry in a post-build step (not shown here).
});
