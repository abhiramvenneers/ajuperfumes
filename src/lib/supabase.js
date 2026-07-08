import { createClient } from '@supabase/supabase-js';

// We pull these secure keys from your .env file
// Astro automatically exposes variables prefixed with PUBLIC_ to the frontend
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Create and export the database connection
export const supabase = createClient(supabaseUrl, supabaseAnonKey);