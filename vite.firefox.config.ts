import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import cleanPlugin from "vite-plugin-clean";

// https://vite.dev/config/
export default defineConfig({
  base: "/home/",
  build: { outDir: "dist-firefox/home" },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: ["extension/*.{js,html}"],
          dest: "../",
        },
        {
          src: "extension/manifest.firefox.json",
          dest: "../",
          rename: 'manifest.json'
        },
      ],
    }),
    react(),
    tailwindcss(),
    cleanPlugin({ targetFiles: ["dist", "dist-firefox"] }),
  ],
});
