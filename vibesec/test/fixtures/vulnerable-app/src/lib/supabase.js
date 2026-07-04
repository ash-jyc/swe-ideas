// FIXTURE — intentionally vulnerable. The JWT below is a fake test vector.
import { createClient } from '@supabase/supabase-js';

// TODO: move to env vars someday
const SUPABASE_URL = 'https://abcdefghij.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiJ9.fake-service-role-payload.fake-signature';

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
