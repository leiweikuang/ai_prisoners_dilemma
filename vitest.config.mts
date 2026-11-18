import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    env: { ENABLE_MOCK_PLAYERS: "true", MOCK_DELAY_MS: "0", MAX_ATTEMPTS: "2", DATA_DIR: ".data/test-games" },
  },
});
