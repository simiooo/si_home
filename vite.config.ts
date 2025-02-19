import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://vite.dev/config/
export default defineConfig({
  base: "/home/",
  build: { outDir: "dist/home" },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "extension/**/*",
          dest: "../",
        },
      ],
    }),
    react(),
    tailwindcss(),
    
  ],
});
