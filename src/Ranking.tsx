import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { updatePlayer } from "./services/playerService";

// Interface définissant la structure d'un joueur
interface Player {
  puuid: string;
  profile_icon_id: number;
  summoner_name: string;
  summoner_level: number;
  rank?: string | null;
  division?: number | null;
  lp?: number | null;
  last_updated: string;
}

// Configuration des effets de glow par position
const GLOW_STYLES = [
  "0 0 50px rgba(255, 215, 0, 0.8), 0 0 30px rgba(255, 215, 0, 0.6)", 
  "0 0 45px rgba(190, 160, 255, 0.6), 0 0 25px rgba(190, 160, 255, 0.6)", 
  "0 0 40px rgba(190, 160, 255, 0.6), 0 0 20px rgba(190, 160, 255, 0.6)", 
  "0 0 35px rgba(150, 100, 255, 0.5)",
  "0 0 30px rgba(150, 100, 255, 0.5)",
  "0 0 25px rgba(120, 80, 200, 0.4)",
];

// Ordre des rangs pour le tri
const RANK_ORDER: { [key: string]: number } = {
  'CHALLENGER': 10, 'GRANDMASTER': 9, 'MASTER': 8,
  'DIAMOND': 7, 'EMERALD': 6, 'PLATINUM': 5,
  'GOLD': 4, 'SILVER': 3, 'BRONZE': 2, 'IRON': 1
};

// Fonction pour convertir les chiffres en chiffres romains
const getRomanDivision = (division: number | null) => {
  const numberToRoman: { [key: number]: string } = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV'
  };
  return division ? numberToRoman[division] : '';
};

// Fonction de tri des joueurs
const sortPlayers = (players: Player[]): Player[] => {
  return [...players].sort((a, b) => {
    if (!a.rank && !b.rank) return 0;
    if (!a.rank) return 1;
    if (!b.rank) return -1;
    
    const aRankValue = RANK_ORDER[a.rank] || 0;
    const bRankValue = RANK_ORDER[b.rank] || 0;
    
    if (bRankValue !== aRankValue) {
      return bRankValue - aRankValue;
    }
    
    // Même rang, trier par division puis LP
    if (b.division !== a.division) {
      return (a.division || 0) - (b.division || 0);
    }
    
    return (b.lp || 0) - (a.lp || 0);
  });
};

// Composant pour afficher une carte de joueur individuelle
function PlayerCard({ player, index, isUpdating = false, hasChanged = false }: { 
  player: Player; 
  index: number;
  isUpdating?: boolean;
  hasChanged?: boolean;
}) {
  const navigate = useNavigate();
  
  const iconUrl = `http://ddragon.leagueoflegends.com/cdn/13.24.1/img/profileicon/${player.profile_icon_id}.png`;

  return (
    <div
      onClick={() => navigate(`/users/${player.summoner_name}`)}
      className={`relative flex flex-col items-center text-center bg-gradient-to-b from-zinc-950 via-black to-zinc-900 
      rounded-2xl px-6 py-5 w-72 border border-violet-700/40 transition-all duration-500 cursor-pointer
      ${hasChanged ? 'animate-pulse border-green-500' : ''}
      ${isUpdating ? 'opacity-70' : 'hover:scale-105'}`}
      style={{ boxShadow: GLOW_STYLES[index] || GLOW_STYLES[5] }}
    >
      {/* Badge position */}
      <div className="absolute -top-3 -left-3 w-8 h-8 bg-gradient-to-br from-violet-600 to-purple-800 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-white">
        #{index + 1}
      </div>
      
      <img 
        src={iconUrl} 
        alt={player.summoner_name} 
        className="w-16 h-16 mb-2 rounded-full drop-shadow-[0_0_15px_rgba(150,100,255,0.5)]" 
      />
      
      <p className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-300 to-violet-600 uppercase">
        {player.summoner_name}
      </p>
      
      <p className="text-sm text-gray-400">Niveau {player.summoner_level}</p>
      
      <p className="text-sm text-gray-400">
        {player.rank ? `${player.rank} ${getRomanDivision(player.division)} — ${player.lp} LP` : "Non classé"}
      </p>
      
      <div className="w-full h-1 mt-3 bg-gradient-to-r from-violet-600 via-white to-violet-600 rounded-full shadow-[0_0_8px_#a78bfa]" />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-gray-200">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mb-4" />
      <p className="text-lg text-violet-300">Chargement des joueurs...</p>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-gray-200">
      <p className="text-red-400 text-xl mb-4">❌ {error}</p>
      <button 
        onClick={onRetry}
        className="px-6 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
      >
        Réessayer
      </button>
    </div>
  );
}

// =============================================================================
// ✅ NOUVELLE FONCTION : Récupérer les joueurs depuis le backend
// =============================================================================
const fetchPlayersFromBackend = async (): Promise<Player[]> => {
  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
    
    console.log("🔍 Récupération des joueurs depuis le backend...");
    
    // Récupérer tous les joueurs depuis la route /players (à créer dans ton backend)
    const response = await fetch(`${backendUrl}/players`);
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const players = await response.json();
    console.log("✅ Joueurs récupérés depuis le backend:", players);
    return players;
    
  } catch (error) {
    console.error("❌ Erreur récupération backend:", error);
    throw error;
  }
};

export default function Ranking() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playersToFetch = [
    { name: "PANTHEKING", tag: "000", region: "euw1" },  
    { name: "KC Yougvai", tag: "MYCEO", region: "euw1" },
    { name: "ANZAR", tag: "AMZ", region: "euw1" },
    { name: "ROI DU NORD", tag: "STARK", region: "euw1" },
    { name: "0000000", tag: "VOID", region: "euw1" },
    { name: "full loose", tag: "sad", region: "euw1" },
  ];

  // ===========================================================================
  // ✅ CORRECTION : Charger les joueurs depuis le backend
  // ===========================================================================
  const loadPlayers = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("🔍 Chargement des joueurs depuis le backend...");
      
      // Récupérer les joueurs depuis ton backend
      const backendPlayers = await fetchPlayersFromBackend();
      const sortedPlayers = sortPlayers(backendPlayers);
      
      console.log("✅ Joueurs chargés depuis le backend:", sortedPlayers);
      setPlayers(sortedPlayers);
      
    } catch (err) {
      console.error('💥 Erreur chargement backend:', err);
      setError("Erreur lors du chargement des joueurs depuis le serveur");
    } finally {
      setLoading(false);
    }
  };

  // ===========================================================================
  // ✅ CORRECTION : Mettre à jour tous les joueurs
  // ===========================================================================
  const updateAllPlayers = async () => {
    try {
      setUpdating(true);
      setError(null);
      console.log("🔄 Début de la mise à jour via API Riot...");
      
      const updatedPlayers: Player[] = [];
      
      for (const player of playersToFetch) {
        try {
          console.log(`🔄 Mise à jour: ${player.name}#${player.tag}`);
          const playerData = await updatePlayer(player.name, player.region, player.tag);
          
          if (playerData) {
            updatedPlayers.push({
              ...playerData,
              last_updated: new Date().toISOString()
            });
            console.log(`✅ ${player.name} mis à jour`);
          }
          
          // Petit délai pour éviter le rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.error(`❌ Erreur mise à jour ${player.name}:`, err);
        }
      }

      if (updatedPlayers.length > 0) {
        const sortedPlayers = sortPlayers(updatedPlayers);
        console.log("✅ Mise à jour terminée:", sortedPlayers);
        setPlayers(sortedPlayers);
      } else {
        console.log("⚠️ Aucun joueur mis à jour - rechargement depuis le backend");
        // Si aucun joueur n'a pu être mis à jour, recharger depuis le backend
        await loadPlayers();
      }

    } catch (err) {
      console.error('💥 Erreur mise à jour globale:', err);
      setError("Erreur lors de la mise à jour des joueurs");
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    console.log("🎯 Composant Ranking monté");
    loadPlayers();
  }, []);

  // Debug: afficher l'état actuel
  console.log("📊 État actuel:", { loading, error, playersCount: players.length });

  if (loading) {
    console.log("🔄 Affichage état loading");
    return <LoadingState />;
  }
  
  if (error) {
    console.log("❌ Affichage état error:", error);
    return <ErrorState error={error} onRetry={loadPlayers} />;
  }
  
  if (players.length === 0) {
    console.log("📭 Aucun joueur");
    return <ErrorState error="Aucun joueur disponible" onRetry={loadPlayers} />;
  }

  console.log("✅ Affichage normal avec", players.length, "joueurs");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-gray-200 py-16 px-6">
      <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-white to-violet-700 mb-8">
        RANKING
      </h1>
      
      {/* Bouton de mise à jour */}
      <button 
        onClick={updateAllPlayers}
        disabled={updating}
        className={`px-8 py-3 mb-12 rounded-lg font-bold text-lg transition-all duration-300 ${
          updating 
            ? 'bg-gray-600 cursor-not-allowed' 
            : 'bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 hover:scale-105'
        }`}
      >
        {updating ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Mise à jour...
          </div>
        ) : (
          '🔄 Mettre à jour le classement'
        )}
      </button>

      <div className="flex flex-col items-center space-y-6">
        {players.map((player, index) => (
          <PlayerCard 
            key={player.puuid} 
            player={player} 
            index={index}
            isUpdating={updating}
          />
        ))}
      </div>
    </div>
  );
}