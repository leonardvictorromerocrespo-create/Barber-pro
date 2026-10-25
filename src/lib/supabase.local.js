import { createLocalClient } from './local-client';
// Replaces the remote module entirely in the local bundle.
export const supabase = createLocalClient();
