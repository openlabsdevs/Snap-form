function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const rawPort = process.env.PORT;
const parsedPort = rawPort ? Number(rawPort) : 3000;
if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
  throw new Error("Invalid PORT: must be an integer between 1 and 65535");
}

export const config = {
  port: parsedPort,
  databaseUrl: requireEnv("DATABASE_URL"),
  auth: {
    secret: requireEnv("BETTER_AUTH_SECRET"),
    url: requireEnv("BETTER_AUTH_URL"),
  },
  oauth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    githubClientId: process.env.GITHUB_CLIENT_ID || "",
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  },
  frontend: {
    url: process.env.FRONTEND_URL || "http://localhost:3001",
  },
  ai: {
    apiKey: process.env.OPENROUTER_API_KEY || "",
    model: process.env.AI_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free",
    conversationWindowSize: (() => {
      const raw = process.env.CONVERSATION_WINDOW_SIZE?.trim();
      if (!raw || !/^\d+$/.test(raw)) return 5;
      const parsed = Number(raw);
      return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 5;
    })(),

  },

};
