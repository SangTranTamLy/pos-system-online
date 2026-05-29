import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizeSupabaseUrl(url: string) {
  return url.replace(/\/rest\/v1\/?$/, "");
}

const supabaseUrl = normalizeSupabaseUrl(
  getRequiredEnv("SUPABASE_URL")
);
const supabaseServiceRoleKey = getRequiredEnv(
  "SUPABASE_SERVICE_ROLE_KEY"
);

export const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey
);
