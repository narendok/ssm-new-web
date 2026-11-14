// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";

// Keep Vite's disposable optimizer cache inside the workspace. The Windows
// LocalAppData location can reject atomic rename/removal during dependency
// optimization, leaving stale optimized-dependency URLs on the next startup.
const viteCacheDir = path.join(process.cwd(), ".vite-cache");

export default defineConfig({
  vite: {
    // This generated directory is ignored by Git and remains available to local
    // development without relying on profile-level cache permissions.
    cacheDir: viteCacheDir,
    // The single portal route carries the complete workspace shell. Transform it
    // during dev startup so the first browser navigation does not wait for a cold
    // client/SSR dependency waterfall.
    server: {
      warmup: {
        clientFiles: ["./src/routes/index.tsx"],
        ssrFiles: ["./src/routes/index.tsx"],
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
