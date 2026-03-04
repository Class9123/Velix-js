import { defineConfig } from "vite";
import path from "path";
import Scan from "./Package/plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: {
    alias: {
      velix: path.resolve(__dirname, "Package")
    }
  },
  plugins: [tailwindcss(), Scan()]
});
