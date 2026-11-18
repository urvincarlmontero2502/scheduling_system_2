import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const backendTarget = env.VITE_API_URL
    ? new URL(env.VITE_API_URL).origin
    : "http://scheduler-backend.test";

  return {
    plugins: [react()],
    build: {
      sourcemap: false,
      minify: "esbuild",
    },
    server: {
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        "/sanctum": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
