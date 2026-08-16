import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server on 5173 talks to the backend on 4000 (see src/lib/apiClient.ts /
// .env.example). No proxy needed since the backend already sends
// permissive CORS headers (see backend src/app.ts's app.use(cors())).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
