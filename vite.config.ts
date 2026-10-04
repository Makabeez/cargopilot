import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ command, isPreview }) => ({
  server: { host: "0.0.0.0", port: 8080 },
  preview: { host: "0.0.0.0", port: 8081 },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    // Serverless output for Vercel; /api/agent runs as a Node function.
    ...(command === "build" || isPreview ? [nitro({ preset: process.env.NITRO_PRESET ?? "vercel", vercel: { functions: { maxDuration: 120 } } })] : []),
    viteReact(),
  ],
}));
