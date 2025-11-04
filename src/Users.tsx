import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";

// =============================================================================
// 🔹 INTERFACES ET TYPES
// =============================================================================

interface PlayerDetail {
  id: number;
  summonername: string;
  summoner_id: string;
  puuid: string;
  rank: string | null;
  division: number | null;
  lp: number | null;
  profile_icon_id: number;
  summoner_level: number;
  last_updated: string;
  region?: string;
}

interface Match {
  id: number;
  match_id: string;
  data: any;
  created_at: string;
  game_mode?: string;
  queue_id?: number;
  region?: string;
  game_creation?: number;
  game_duration?: number;
}

interface ChampionStats {
  name: string;
  wins: number;
  losses: number;
  total: number;
  kda: number;
  games: number;
  winrate: number;
  kills: number;
  deaths: number;
  assists: number;
  csPerMinute: number;
}

interface Game {
  id: string;
  match_id: string;
  result: "Victoire" | "Défaite";
  champion: string;
  kda: string;
  kdaRatio: number;
  cs: number;
  csPerMinute: number;
  duration: string;
  date: string;
  gameMode: string;
  role?: string;
  queueId?: number;
  championId?: number;
  visionScore?: number;
  damageDealt?: number;
}

interface AdvancedStats {
  totalGames: number;
  wins: number;
  losses: number;
  winrate: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  averageKDA: number;
  averageKills: number;
  averageDeaths: number;
  averageAssists: number;
  averageCS: number;
  averageCSperMin: number;
  averageGameDuration: number;
  favoriteRole: string;
  totalCS: number;
  bestChampion?: ChampionStats;
  recentWinrate: number;
  rank: string;
  division: number | null;
  lp: number | null;
}

// =============================================================================
// 🔹 CONSTANTES ET CONFIGURATIONS
// =============================================================================

const RANKED_SOLO_QUEUE_ID = 420;

// Couleurs de texte pour chaque rang
const rankColors: Record<string, string> = {
  IRON: "text-gray-400",
  BRONZE: "text-amber-700",
  SILVER: "text-gray-300",
  GOLD: "text-yellow-400",
  PLATINUM: "text-teal-400",
  EMERALD: "text-emerald-400",
  DIAMOND: "text-cyan-300",
  MASTER: "text-purple-400",
  GRANDMASTER: "text-red-500",
  CHALLENGER: "text-yellow-300",
  UNRANKED: "text-gray-400"
};

// Dégradés de fond pour chaque rang
const rankGradients: Record<string, string> = {
  IRON: "from-gray-600 to-gray-800",
  BRONZE: "from-amber-700 to-amber-900",
  SILVER: "from-gray-400 to-gray-600",
  GOLD: "from-yellow-500 to-yellow-700",
  PLATINUM: "from-teal-400 to-teal-600",
  EMERALD: "from-emerald-400 to-emerald-600",
  DIAMOND: "from-cyan-400 to-cyan-600",
  MASTER: "from-purple-500 to-purple-700",
  GRANDMASTER: "from-red-500 to-red-700",
  CHALLENGER: "from-yellow-300 to-yellow-500",
  UNRANKED: "from-gray-500 to-gray-700"
};

// Chemins des images d'emblèmes de rang
const rankEmblems: Record<string, string> = {
  IRON: "/image/iron.png",
  BRONZE: "/image/bronze.png",
  SILVER: "/image/silver.png",
  GOLD: "/image/gold.png",
  PLATINUM: "/image/platine.png",
  EMERALD: "/image/emeraude.png",
  DIAMOND: "/image/diamant.png",
  MASTER: "/image/master.png",
  GRANDMASTER: "/image/grandmaster.png",
  CHALLENGER: "/image/challenger.png",
  UNRANKED: "/image/unranked.png"
};

// Icônes pour les rôles
const roleIcons: Record<string, string> = {
  'Top': '⚔️',
  'Jungle': '🌿',
  'Mid': '🔥',
  'ADC': '🏹',
  'Support': '🛡️',
  'Autre': '❓'
};

// =============================================================================
// 🔹 COMPOSANTS RÉUTILISABLES
// =============================================================================

// Composant de chargement
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-950 flex items-center justify-center">
    <div className="text-center">
      <div className="relative">
        <div className="animate-spin rounded-full h-20 w-20 border-b-2 border-violet-500 mx-auto mb-4"></div>
        <div className="absolute inset-0 animate-ping rounded-full h-20 w-20 border-2 border-violet-300 opacity-75"></div>
      </div>
      <p className="text-gray-400 text-lg mt-4">Chargement des données Ranked Solo/Duo...</p>
      <p className="text-gray-500 text-sm mt-2">Récupération depuis l'API Riot</p>
    </div>
  </div>
);

// Composant d'état d'erreur
const ErrorState = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-950 flex items-center justify-center">
    <div className="text-center max-w-md">
      <div className="text-6xl mb-4">😕</div>
      <h2 className="text-red-400 text-xl mb-2">Erreur de chargement</h2>
      <p className="text-gray-400 mb-6">{error}</p>
      <div className="space-y-3">
        <button 
          onClick={onRetry}
          className="w-full px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-lg transition-all duration-300 transform hover:scale-105"
        >
          🔄 Réessayer
        </button>
        <button 
          onClick={() => window.history.back()}
          className="w-full px-6 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
        >
          ← Retour
        </button>
      </div>
    </div>
  </div>
);

// Carte de statistique
const StatCard = ({ title, value, subtitle, color = "text-white", icon, trend }: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  color?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
}) => (
  <div className="bg-zinc-900/60 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-violet-500/30 transition-all duration-300 hover:transform hover:scale-105 group">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">{title}</h3>
      <div className="flex items-center gap-2">
        {trend && (
          <span className={`text-sm ${
            trend === 'up' ? 'text-green-400' : 
            trend === 'down' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
          </span>
        )}
        {icon && <span className="text-lg">{icon}</span>}
      </div>
    </div>
    <p className={`text-2xl font-bold ${color} mb-1`}>{value}</p>
    {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
  </div>
);

// Carte de champion
const ChampionCard = ({ champion, rank }: { champion: ChampionStats; rank: number }) => (
  <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-6 border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:scale-105 group">
    <div className="flex items-start justify-between mb-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 px-2 py-1 rounded-full">
            #{rank}
          </span>
          <h3 className="text-lg font-bold text-white">{champion.name}</h3>
        </div>
        <p className="text-sm text-gray-400">{champion.games} partie{champion.games > 1 ? 's' : ''}</p>
      </div>
      <div className={`text-right ${champion.winrate >= 60 ? 'text-green-400' : champion.winrate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
        <p className="text-xl font-bold">{champion.winrate}%</p>
        <p className="text-xs text-gray-400">Winrate</p>
      </div>
    </div>
    
    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
      <div>
        <p className="text-green-400">{champion.wins}V</p>
        <p className="text-red-400">{champion.losses}D</p>
      </div>
      <div className="text-right">
        <p className="text-yellow-400">KDA {champion.kda.toFixed(2)}</p>
        <p className="text-gray-400 text-xs">
          {champion.kills}/{champion.deaths}/{champion.assists}
        </p>
      </div>
    </div>

    <div className="text-xs text-gray-400 mb-2">
      CS/min: <span className="text-white">{champion.csPerMinute.toFixed(1)}</span>
    </div>
    
    {/* Barre de winrate */}
    <div className="mt-2">
      <div className="w-full bg-zinc-700 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-500 ${
            champion.winrate >= 60 ? 'bg-green-500' : 
            champion.winrate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${Math.min(champion.winrate, 100)}%` }}
        ></div>
      </div>
    </div>
  </div>
);

// Carte de partie
const GameCard = ({ game }: { game: Game }) => (
  <div
    className={`p-5 rounded-2xl border-l-4 backdrop-blur-sm ${
      game.result === "Victoire"
        ? "border-green-500 bg-gradient-to-r from-green-900/20 to-green-900/5 hover:from-green-900/30"
        : "border-red-500 bg-gradient-to-r from-red-900/20 to-red-900/5 hover:from-red-900/30"
    } transition-all duration-300 hover:scale-[1.02] group`}
  >
    <div className="flex justify-between items-start mb-3">
      <div className="flex items-center gap-3">
        <span className={`text-lg font-bold ${
          game.result === "Victoire" ? "text-green-400" : "text-red-400"
        }`}>
          {game.result}
        </span>
        {game.role && (
          <span className="text-xs bg-white/10 px-2 py-1 rounded flex items-center gap-1">
            {roleIcons[game.role]} {game.role}
          </span>
        )}
      </div>
      <span className="text-gray-400 text-sm">{game.date}</span>
    </div>
    
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="font-semibold text-white text-lg">{game.champion}</p>
        <span className="text-sm text-gray-400">Ranked Solo</span>
      </div>
      
      <div className="flex justify-between items-center text-sm">
        <span className={game.kdaRatio >= 4 ? "text-green-400" : game.kdaRatio >= 2 ? "text-yellow-400" : "text-red-400"}>
          <strong>KDA:</strong> {game.kda} <span className="text-gray-400">({game.kdaRatio.toFixed(2)})</span>
        </span>
        <span className="text-gray-400">
          <strong>CS:</strong> {game.cs} <span className="text-xs">({game.csPerMinute.toFixed(1)}/min)</span>
        </span>
      </div>
      
      <div className="flex justify-between text-xs text-gray-400">
        <span>Durée: {game.duration}</span>
        <span>Queue: Ranked Solo</span>
      </div>
    </div>
  </div>
);

// =============================================================================
// 🔹 COMPOSANT PRINCIPAL
// =============================================================================

export default function User() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  
  // États du composant
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [championStats, setChampionStats] = useState<ChampionStats[]>([]);
  const [lastGames, setLastGames] = useState<Game[]>([]);
  const [advancedStats, setAdvancedStats] = useState<AdvancedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // ===========================================================================
  // 🔹 FONCTIONS UTILITAIRES MÉMORISÉES
  // ===========================================================================

  // Convertit la division en chiffres romains
  const getRomanDivision = (division: number | null): string => {
    const numberToRoman: { [key: number]: string } = {
      1: 'I', 2: 'II', 3: 'III', 4: 'IV'
    };
    return division ? numberToRoman[division] : '';
  };

  // Formate la durée de jeu
  const formatGameDuration = (duration: number): string => {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
  };

  // Détermine le rôle du joueur
  const getPlayerRole = (teamPosition: string): string => {
    const roleMap: Record<string, string> = {
      'TOP': 'Top',
      'JUNGLE': 'Jungle', 
      'MIDDLE': 'Mid',
      'BOTTOM': 'ADC',
      'UTILITY': 'Support',
      '': 'Autre'
    };
    return roleMap[teamPosition] || 'Autre';
  };

  // ===========================================================================
  // 🔹 CALCULS MÉMORISÉS
  // ===========================================================================

  // Filtre les matchs ranked solo seulement
  const rankedSoloMatches = useMemo(() => {
    console.log("🎯 Filtrage des ranked solo matches:", matches.length, "matchs totaux");
    const soloMatches = matches.filter(match => {
      const isRankedSolo = match.queue_id === RANKED_SOLO_QUEUE_ID;
      console.log(`📊 Match ${match.match_id}: queue_id=${match.queue_id}, isRankedSolo=${isRankedSolo}`);
      return isRankedSolo;
    });
    console.log("✅ Matchs ranked solo trouvés:", soloMatches.length);
    return soloMatches;
  }, [matches]);

  // Calcule le winrate des 10 dernières parties
  const recentWinrate = useMemo(() => {
    const recentGames = rankedSoloMatches.slice(0, 10);
    if (recentGames.length === 0) return 0;
    
    const wins = recentGames.filter(match => {
      const participant = match.data.info.participants.find((p: any) => 
        p.puuid === player?.puuid
      );
      return participant?.win;
    }).length;
    
    return Math.round((wins / recentGames.length) * 100);
  }, [rankedSoloMatches, player]);

  // Détermine la couleur du KDA
  const kdaColor = useMemo(() => {
    if (!advancedStats?.averageKDA) return "text-gray-400";
    if (advancedStats.averageKDA >= 3) return "text-green-400";
    if (advancedStats.averageKDA >= 2) return "text-yellow-400";
    return "text-red-400";
  }, [advancedStats?.averageKDA]);

  // Informations sur le rang du joueur
  const playerRankInfo = useMemo(() => {
    const rank = player?.rank || "UNRANKED";
    return {
      name: rank,
      display: player?.rank ? `${rank} ${getRomanDivision(player.division)}` : "Non classé",
      color: rankColors[rank] || rankColors.UNRANKED,
      gradient: rankGradients[rank] || rankGradients.UNRANKED,
      emblem: rankEmblems[rank] || rankEmblems.UNRANKED, // Utilise les images d'emblèmes
      lp: player?.lp
    };
  }, [player]);

  // ===========================================================================
  // 🔹 FONCTIONS DE TRAITEMENT (RANKED SOLO SEULEMENT)
  // ===========================================================================

  // Crée un objet Game à partir des données de match
  const createGameFromMatch = (match: Match, playerData: PlayerDetail): Game | null => {
    try {
      console.log(`🎮 Traitement du match ${match.match_id} (queue: ${match.queue_id})`);

      const participant = match.data.info.participants.find((p: any) => 
        p.puuid === playerData.puuid
      );
      
      if (!participant) {
        console.log("❌ Participant non trouvé dans le match");
        return null;
      }

      const kdaRatio = participant.deaths > 0 
        ? (participant.kills + participant.assists) / participant.deaths 
        : participant.kills + participant.assists;

      const gameDurationMinutes = match.data.info.gameDuration / 60;
      const csPerMinute = (participant.totalMinionsKilled + (participant.neutralMinionsKilled || 0)) / gameDurationMinutes;

      const gameData: Game = {
        id: `${match.match_id}-${participant.puuid}`,
        match_id: match.match_id,
        result: participant.win ? "Victoire" : "Défaite",
        champion: participant.championName,
        kda: `${participant.kills}/${participant.deaths}/${participant.assists}`,
        kdaRatio,
        cs: participant.totalMinionsKilled + (participant.neutralMinionsKilled || 0),
        csPerMinute,
        duration: formatGameDuration(match.data.info.gameDuration),
        date: new Date(match.data.info.gameCreation).toLocaleDateString('fr-FR'),
        gameMode: "Ranked Solo",
        role: getPlayerRole(participant.teamPosition),
        queueId: match.queue_id,
        championId: participant.championId,
        visionScore: participant.visionScore,
        damageDealt: participant.totalDamageDealtToChampions
      };

      console.log("✅ Match traité:", gameData);
      return gameData;
    } catch (error) {
      console.error("❌ Erreur traitement match ranked solo:", error);
      return null;
    }
  };

  // Calcule les statistiques avancées
  const calculateAdvancedStats = (matchesData: Match[], playerData: PlayerDetail): AdvancedStats | null => {
    // Filtrer seulement les ranked solo
    const rankedSoloData = matchesData.filter(match => match.queue_id === RANKED_SOLO_QUEUE_ID);
    console.log("📊 Calcul stats avancées sur", rankedSoloData.length, "matchs ranked solo");

    if (!rankedSoloData.length) {
      console.log("❌ Aucune donnée ranked solo pour les stats avancées");
      return null;
    }

    const stats = {
      totalGames: rankedSoloData.length,
      wins: 0,
      losses: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalAssists: 0,
      totalCS: 0,
      totalGameMinutes: 0,
      roles: {} as Record<string, number>,
      recentWins: 0
    };

    rankedSoloData.forEach((match, index) => {
      const participant = match.data.info.participants.find((p: any) => 
        p.puuid === playerData.puuid
      );

      if (participant) {
        if (participant.win) {
          stats.wins++;
          if (index < 10) stats.recentWins++;
        } else {
          stats.losses++;
        }
        
        stats.totalKills += participant.kills;
        stats.totalDeaths += participant.deaths;
        stats.totalAssists += participant.assists;
        stats.totalCS += participant.totalMinionsKilled + (participant.neutralMinionsKilled || 0);
        stats.totalGameMinutes += match.data.info.gameDuration / 60;
        
        const role = getPlayerRole(participant.teamPosition);
        stats.roles[role] = (stats.roles[role] || 0) + 1;
      }
    });

    const favoriteRole = Object.entries(stats.roles).reduce((a, b) => 
      a[1] > b[1] ? a : b, ['Inconnu', 0]
    )[0];

    const averageGameMinutes = stats.totalGameMinutes / stats.totalGames;

    const advancedStatsData: AdvancedStats = {
      totalGames: stats.totalGames,
      wins: stats.wins,
      losses: stats.losses,
      winrate: stats.totalGames > 0 ? (stats.wins / stats.totalGames) * 100 : 0,
      totalKills: stats.totalKills,
      totalDeaths: stats.totalDeaths,
      totalAssists: stats.totalAssists,
      averageKDA: stats.totalDeaths > 0 
        ? (stats.totalKills + stats.totalAssists) / stats.totalDeaths 
        : stats.totalKills + stats.totalAssists,
      averageKills: stats.totalGames > 0 ? stats.totalKills / stats.totalGames : 0,
      averageDeaths: stats.totalGames > 0 ? stats.totalDeaths / stats.totalGames : 0,
      averageAssists: stats.totalGames > 0 ? stats.totalAssists / stats.totalGames : 0,
      averageCS: stats.totalGames > 0 ? stats.totalCS / stats.totalGames : 0,
      averageCSperMin: stats.totalGameMinutes > 0 ? stats.totalCS / stats.totalGameMinutes : 0,
      averageGameDuration: averageGameMinutes * 60,
      favoriteRole,
      totalCS: stats.totalCS,
      recentWinrate: stats.recentWins / Math.min(10, rankedSoloData.length) * 100,
      rank: playerData.rank || "UNRANKED",
      division: playerData.division,
      lp: playerData.lp
    };

    console.log("✅ Stats avancées calculées:", advancedStatsData);
    return advancedStatsData;
  };

  // Calcule les statistiques par champion
  const calculateChampionStats = (matchesData: Match[], playerData: PlayerDetail): ChampionStats[] => {
    // Filtrer seulement les ranked solo
    const rankedSoloData = matchesData.filter(match => match.queue_id === RANKED_SOLO_QUEUE_ID);
    console.log("📊 Calcul stats champions sur", rankedSoloData.length, "matchs ranked solo");

    if (!rankedSoloData.length) {
      console.log("❌ Aucune donnée ranked solo pour les stats champions");
      return [];
    }

    const champStats = new Map<string, ChampionStats>();
    
    rankedSoloData.forEach(match => {
      const participant = match.data.info.participants.find((p: any) => 
        p.puuid === playerData.puuid
      );
      
      if (participant) {
        const champName = participant.championName;
        const current = champStats.get(champName) || { 
          name: champName,
          wins: 0, 
          losses: 0, 
          kills: 0, 
          deaths: 0, 
          assists: 0,
          games: 0,
          kda: 0,
          winrate: 0,
          csPerMinute: 0
        };
        
        if (participant.win) current.wins++;
        else current.losses++;
        
        current.kills += participant.kills;
        current.deaths += participant.deaths;
        current.assists += participant.assists;
        current.games++;
        
        // Calcul CS/minute
        const gameMinutes = match.data.info.gameDuration / 60;
        const csThisGame = participant.totalMinionsKilled + (participant.neutralMinionsKilled || 0);
        current.csPerMinute = ((current.csPerMinute * (current.games - 1)) + (csThisGame / gameMinutes)) / current.games;
        
        champStats.set(champName, current);
      }
    });

    const championStatsData = Array.from(champStats.values())
      .map(stats => ({
        ...stats,
        total: stats.wins + stats.losses,
        kda: stats.deaths > 0 ? (stats.kills + stats.assists) / stats.deaths : stats.kills + stats.assists,
        winrate: Math.round((stats.wins / stats.games) * 100)
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 5);

    console.log("✅ Stats champions calculées:", championStatsData.length, "champions");
    return championStatsData;
  };

  // Traite toutes les données des matchs
  const processMatchesData = (matchesData: Match[], playerData: PlayerDetail) => {
    console.log("🔄 Début du traitement des données...");
    
    // Filtrer seulement les ranked solo pour l'affichage
    const rankedSoloData = matchesData.filter(match => match.queue_id === RANKED_SOLO_QUEUE_ID);
    console.log("📁 Matchs ranked solo à traiter:", rankedSoloData.length);
    
    if (!rankedSoloData.length) {
      console.log("❌ Aucun match ranked solo à afficher");
      setLastGames([]);
      setChampionStats([]);
      setAdvancedStats(null);
      return;
    }

    const processedGames = rankedSoloData
      .slice(0, 10) // Seulement les 10 derniers matchs
      .map(match => createGameFromMatch(match, playerData))
      .filter((game): game is Game => game !== null);

    const champStats = calculateChampionStats(matchesData, playerData);
    const advStats = calculateAdvancedStats(matchesData, playerData);

    console.log("🎯 Données traitées:", {
      games: processedGames.length,
      champions: champStats.length,
      hasAdvancedStats: !!advStats
    });

    setLastGames(processedGames);
    setChampionStats(champStats);
    setAdvancedStats(advStats);
  };

  // ===========================================================================
  // 🔹 FONCTIONS API
  // ===========================================================================

  // Récupère les données du joueur
  const fetchPlayerData = async () => {
    if (!name) {
      setError("Nom du joueur manquant");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
      console.log("🌐 Début du chargement des données...");

      // Récupération joueur
      console.log("📡 Récupération des infos du joueur...");
      const playerResponse = await fetch(`${backendUrl}/player/${encodeURIComponent(name)}`);
      if (!playerResponse.ok) throw new Error("Joueur non trouvé");
      
      const playerData: PlayerDetail = await playerResponse.json();
      console.log("✅ Données joueur reçues:", playerData);
      setPlayer(playerData);

      // Récupération matchs
      console.log("📡 Récupération des matchs...");
      const matchesResponse = await fetch(`${backendUrl}/player/${encodeURIComponent(name)}/matches`);
      if (!matchesResponse.ok) throw new Error("Erreur lors de la récupération des matchs");

      const matchesResult = await matchesResponse.json();
      console.log("📦 Réponse complète matches API:", matchesResult);

      // Extraire le tableau matches
      const matchesData = matchesResult.matches || matchesResult;
      console.log("🎯 Données matches extraites:", Array.isArray(matchesData) ? `${matchesData.length} matchs` : "Format invalide");
      
      if (Array.isArray(matchesData)) {
        console.log("✅ Matchs valides, traitement en cours...");
        setMatches(matchesData);
        processMatchesData(matchesData, playerData);
      } else {
        console.log("❌ matchesData n'est pas un tableau");
        setMatches([]);
        setLastGames([]);
        setChampionStats([]);
        setAdvancedStats(null);
      }

    } catch (err: any) {
      console.error("💥 Erreur chargement:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      console.log("🏁 Chargement terminé");
    }
  };

  // Met à jour toutes les données
  const updateAllData = async () => {
    if (!name) return;
    
    try {
      setUpdating(true);
      console.log("🔄 Début de la mise à jour...");
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
      
      // Récupérer seulement 10 matchs
      console.log("📡 Mise à jour des matchs (limite: 10)...");
      const matchesResponse = await fetch(`${backendUrl}/player/${name}/matches/update?limit=10`);
      const matchesResult = await matchesResponse.json();
      
      console.log("✅ Résultat mise à jour:", matchesResult);
      
      if (matchesResult.success) {
        // Recharger toutes les données
        console.log("🔄 Rechargement des données après mise à jour...");
        await fetchPlayerData();
      } else {
        console.log("❌ Échec de la mise à jour:", matchesResult);
      }
    } catch (error) {
      console.error("❌ Erreur mise à jour:", error);
    } finally {
      setUpdating(false);
      console.log("🏁 Mise à jour terminée");
    }
  };

  // ===========================================================================
  // 🔹 EFFETS
  // ===========================================================================

  // Charge les données au montage du composant
  useEffect(() => {
    console.log("🎯 Composant monté, chargement des données...");
    fetchPlayerData();
  }, [name]);

  // ===========================================================================
  // 🔹 RENDU
  // ===========================================================================

  if (loading) return <LoadingSpinner />;
  if (error || !player) return <ErrorState error={error || "Joueur non trouvé"} onRetry={fetchPlayerData} />;

  console.log("🎨 Rendu de l'interface avec:", {
    player: !!player,
    matches: matches.length,
    rankedSoloMatches: rankedSoloMatches.length,
    lastGames: lastGames.length,
    championStats: championStats.length,
    advancedStats: !!advancedStats
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-950 text-gray-200 p-4 md:p-8">
      
      {/* HEADER */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          {/* Bouton retour */}
          <button
            onClick={() => navigate("/ranking")}
            className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-semibold transition-all duration-300 hover:scale-105 flex items-center gap-2 group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
            Retour au classement
          </button>
          
          {/* Indicateur et bouton mise à jour */}
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
              <p className="text-blue-300 text-sm font-semibold">🎯 Ranked Solo/Duo Only</p>
            </div>
            <button 
              onClick={updateAllData}
              disabled={updating}
              className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 rounded-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {updating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Mise à jour...
                </>
              ) : (
                <>
                  🔄 Mettre à jour
                </>
              )}
            </button>
          </div>
        </div>

        {/* PROFIL RANKED SOLO */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-12">
          {/* Icône de profil */}
          <div className="relative">
            <img 
              src={`https://ddragon.leagueoflegends.com/cdn/14.2.1/img/profileicon/${player.profile_icon_id}.png`}
              alt={player.summonername}
              className="w-28 h-28 rounded-2xl border-4 border-violet-600 shadow-2xl shadow-violet-500/30"
            />
            <div className="absolute -bottom-2 -right-2 bg-zinc-900 rounded-full px-3 py-1 border border-violet-500 text-sm">
              {player.summoner_level}
            </div>
          </div>
          
          {/* Informations du joueur */}
          <div className="flex-1">
            <h1 className="text-4xl md:text-6xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-cyan-200">
              {player.summonername}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4">
              {/* Badge de rang avec emblème d'image */}
              <div className={`px-6 py-3 rounded-2xl bg-gradient-to-r ${playerRankInfo.gradient} border-2 ${playerRankInfo.color} shadow-2xl flex items-center gap-3`}>
                {/* ✅ CORRECTION : Utilisation de l'image d'emblème */}
                <img 
                  src={playerRankInfo.emblem} 
                  alt={`${playerRankInfo.name} emblem`}
                  className="w-8 h-8 object-contain"
                />
                <div>
                  <p className="text-xl font-bold text-white">
                    {playerRankInfo.display}
                  </p>
                  {playerRankInfo.lp !== null && (
                    <p className="text-sm text-white/80">{playerRankInfo.lp} LP</p>
                  )}
                </div>
              </div>
              
              {/* Région */}
              {player.region && (
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-sm text-gray-300 uppercase tracking-wider">🌍 {player.region}</p>
                </div>
              )}

              {/* Nombre de parties ranked */}
              <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                <p className="text-sm text-gray-300">
                  <strong>{rankedSoloMatches.length}</strong> partie{rankedSoloMatches.length > 1 ? 's' : ''} Ranked Solo
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* STATISTIQUES RANKED SOLO */}
        {advancedStats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            <StatCard 
              title="Winrate Ranked" 
              value={`${advancedStats.winrate.toFixed(1)}%`}
              subtitle={`${advancedStats.wins}V ${advancedStats.losses}D`}
              color={advancedStats.winrate >= 50 ? 'text-green-400' : 'text-red-400'}
              icon="📊"
              trend={advancedStats.winrate >= 50 ? 'up' : 'down'}
            />
            
            <StatCard 
              title="Winrate Récent" 
              value={`${recentWinrate}%`}
              subtitle="10 dernières ranked"
              color={recentWinrate >= 50 ? 'text-green-400' : 'text-red-400'}
              icon="📈"
              trend={recentWinrate >= 50 ? 'up' : 'down'}
            />
            
            <StatCard 
              title="KDA Ranked" 
              value={advancedStats.averageKDA.toFixed(2)}
              subtitle={`${advancedStats.averageKills.toFixed(1)}/${advancedStats.averageDeaths.toFixed(1)}/${advancedStats.averageAssists.toFixed(1)}`}
              color={kdaColor}
              icon="🎯"
            />
            
            <StatCard 
              title="CS/Min" 
              value={advancedStats.averageCSperMin.toFixed(1)}
              subtitle="Moyenne ranked"
              color={advancedStats.averageCSperMin >= 7 ? 'text-green-400' : advancedStats.averageCSperMin >= 5 ? 'text-yellow-400' : 'text-red-400'}
              icon="⚔️"
            />
          </div>
        )}

        {/* TOP CHAMPIONS RANKED SOLO */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <span className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-xl">🏆</span>
              Champions Ranked Solo/Duo
            </h2>
            <span className="text-gray-400 text-sm">
              {championStats.length} champion{championStats.length > 1 ? 's' : ''} ranked
            </span>
          </div>
          
          {championStats.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {championStats.map((champ, index) => (
                <ChampionCard key={champ.name} champion={champ} rank={index + 1} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">Aucune donnée de champion en Ranked Solo</p>
              <p className="text-gray-400 text-sm mt-2">Les matchs ranked seront analysés après la mise à jour</p>
            </div>
          )}
        </section>

        {/* DERNIÈRES PARTIES RANKED SOLO */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <span className="bg-gradient-to-r from-blue-500 to-cyan-500 p-2 rounded-xl">🎮</span>
              Dernières Ranked Solo/Duo
            </h2>
            <span className="text-gray-400 text-sm">
              {lastGames.length} partie{lastGames.length > 1 ? 's' : ''} ranked
            </span>
          </div>
          
          {lastGames.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {lastGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">Aucune partie Ranked Solo récente</p>
              <p className="text-gray-400 text-sm mt-2">
                Cliquez sur "Mettre à jour" pour charger les parties ranked
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}