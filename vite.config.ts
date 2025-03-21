import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import cleanPlugin from 'vite-plugin-clean'

// https://vite.dev/config/
export default defineConfig({
  base: "/home/",
  build: { outDir: "dist/home" },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: ["extension/*.{js,html}","extension/manifest.json"],
          dest: "../",
        },
      ],
    }),
    react(),
    tailwindcss(),
    cleanPlugin({targetFiles: [
      "dist",
      "dist-firefox"
    ]}),
  ],
});
