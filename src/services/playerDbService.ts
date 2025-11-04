import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface Player {
  puuid: string;
  profile_icon_id: number;
  summoner_name: string;
  summoner_level: number;
  rank?: string | null;
  division?: number | null;
  lp?: number | null;
  last_updated: string;
}

export async function getPlayersFromDb(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('last_updated', { ascending: false });

  if (error) {
    console.error('Erreur BDD:', error);
    return [];
  }

  return data || [];
}