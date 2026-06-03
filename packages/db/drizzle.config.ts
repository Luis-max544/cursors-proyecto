import { defineConfig } from 'drizzle-kit'

// DATABASE_URL must be set in the environment before running drizzle-kit commands.
// From the repo root, use: DATABASE_URL=... pnpm --filter @nutrilearn/db db:generate
export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
