import { createLocalClient, isLoopbackHost } from "./local-client";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://prdmcjykjpxpcomonwuy.supabase.co";
const supabaseKey = "sb_publishable_q6HRvYbfiHZRsRMd7yxqDg_Kbc7pub6";

export const supabase = typeof window !== "undefined" && isLoopbackHost(window.location.hostname) ? createLocalClient() : createClient(supabaseUrl, supabaseKey);