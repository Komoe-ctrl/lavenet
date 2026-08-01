import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  DIRECT_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  CORS_ORIGIN: z.url(),
  // Gates two things, and only these two: whether an OTP response ever
  // includes the raw code (registerResponseSchema/otpResponseSchema's
  // demoOtpCode) and whether SandboxSmsProvider logs it. Default false --
  // must be explicitly opted into, never assumed (CLAUDE.md §11).
  //
  // Not z.coerce.boolean(): that coerces via JS `Boolean(value)`, so the
  // literal string 'false' from an env file -- non-empty -- comes out
  // `true`. Comparing against the exact string is the only correct way to
  // parse a boolean-shaped env var.
  DEMO_MODE: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    // console, not the Nest logger: this runs before Nest bootstraps.
    console.error('Invalid environment configuration:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
