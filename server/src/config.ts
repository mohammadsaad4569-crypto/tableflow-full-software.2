import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development","test","production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(20),
  QR_SECRET: z.string().min(20),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  PAYMENT_MODE: z.enum(["mock","razorpay"]).default("mock"),
  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default("")
});

export const env = envSchema.parse(process.env);
