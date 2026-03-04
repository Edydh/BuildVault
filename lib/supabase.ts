import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type AppExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

function resolveAppExtra(): AppExtra | null {
  const constants = Constants as unknown as {
    expoConfig?: { extra?: AppExtra };
    manifest?: { extra?: AppExtra };
    manifest2?: {
      extra?: {
        expoClient?: { extra?: AppExtra };
      } & AppExtra;
    };
  };

  // In EAS/internal builds, expoConfig may be undefined; manifest2 carries update metadata.
  const manifest2Extra = constants.manifest2?.extra;
  const embeddedExtra = manifest2Extra?.expoClient?.extra;
  return constants.expoConfig?.extra || embeddedExtra || manifest2Extra || constants.manifest?.extra || null;
}

const resolvedExtra = resolveAppExtra();
const supabaseUrl = resolvedExtra?.supabaseUrl || process.env.SUPABASE_URL;
const supabaseAnonKey = resolvedExtra?.supabaseAnonKey || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set via app.config.ts extra or environment.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
