import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: { entry: "server" },
    }),
    react(),
    tailwindcss(),
    nitro({
      preset: "vercel",
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 3000,
    host: true,
    strictPort: true,
  },
});
