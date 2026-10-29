import { createClient } from "@supabase/supabase-js";

/* Clé publishable : publique par design. La sécurité est assurée par RLS
 * et les fonctions security definer côté base (voir supabase/migrations). */
const url = import.meta.env.VITE_SUPABASE_URL || "https://ipdohwwyletjrkdrlyma.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_LgjP7-DwqNAIguffgWO5Fw_DkCeRS9r";

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const SUPABASE_URL = url;
