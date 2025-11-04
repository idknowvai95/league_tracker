import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// =============================================================================
// 🔹 INTERFACES TYPESCRIPT
// =============================================================================

/**
 * Interface pour les données d'un joueur
 */
interface Player {
  id: number;
  summoner_name: string;
  puuid: string;
  rank: string | null;
  division: number | null;
  lp: number | null;
  profile_icon_id: number;
  summoner_level: number;
  region: string;
  wins?: number;
  losses?: number;
}

/**
 * Interface pour les statistiques d'un joueur
 */
interface PlayerStats {
  total_games: number;
  wins: number;
  losses: number;
  winrate: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
  average_kda: number;
  average_kills: number;
  average_deaths: number;
  average_assists: number;
  average_cs: number;
  favorite_role: string;
  best_champion: string;
  champions: {
    [championName: string]: {
      wins: number;
      losses: number;
      games: number;
      kills: number;
      deaths: number;
      assists: number;
      kda: number;
      winrate: number;
    };
  };
}

/**
 * Interface pour les données de comparaison entre deux joueurs
 */
interface ComparisonData {
  player1: Player;
  player2: Player;
  stats1: PlayerStats;
  stats2: PlayerStats;
  championComparison: ChampionComparison[];
  overallComparison: {
    winrate: { player1: number; player2: number };
    kda: { player1: number; player2: number };
    kills: { player1: number; player2: number };
    deaths: { player1: number; player2: number };
    assists: { player1: number; player2: number };
    cs: { player1: number; player2: number };
  };
}

/**
 * Interface pour la comparaison d'un champion entre deux joueurs
 */
interface ChampionComparison {
  champion: string;
  player1: {
    wins: number;
    losses: number;
    games: number;
    kills: number;
    deaths: number;
    assists: number;
    kda: number;
    winrate: number;
  } | null;
  player2: {
    wins: number;
    losses: number;
    games: number;
    kills: number;
    deaths: number;
    assists: number;
    kda: number;
    winrate: number;
  } | null;
}

// =============================================================================
// 🔹 COMPOSANTS RÉUTILISABLES
// =============================================================================

/**
 * Composant pour afficher une comparaison de statistique avec barre de progression
 */
const StatComparisonCard = ({ 
  title, 
  value1, 
  value2, 
  isPercentage = false, 
  isBetter = "higher" 
}: { 
  title: string; 
  value1: number; 
  value2: number; 
  isPercentage?: boolean;
  isBetter?: "higher" | "lower";
}) => {
  /**
   * Formate la valeur selon le type (pourcentage ou nombre)
   */
  const formatValue = (val: number) => isPercentage ? `${val.toFixed(1)}%` : val.toFixed(2);
  
  /**
   * Détermine quel joueur a la meilleure valeur
   */
  const isPlayer1Better = isBetter === "higher" ? value1 > value2 : value1 < value2;

  return (
    <div className="bg-zinc-900/60 rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        {title}
      </h3>
      
      {/* Affichage des valeurs des deux joueurs */}
      <div className="flex justify-between items-center">
        {/* Joueur 1 */}
        <div className={`text-center ${isPlayer1Better ? 'text-green-400' : 'text-gray-400'}`}>
          <div className="text-2xl font-bold">{formatValue(value1)}</div>
          <div className="text-xs mt-1">Joueur 1</div>
        </div>
        
        {/* Séparateur */}
        <div className="text-gray-500 text-sm">VS</div>
        
        {/* Joueur 2 */}
        <div className={`text-center ${!isPlayer1Better ? 'text-green-400' : 'text-gray-400'}`}>
          <div className="text-2xl font-bold">{formatValue(value2)}</div>
          <div className="text-xs mt-1">Joueur 2</div>
        </div>
      </div>
      
      {/* Barre de comparaison visuelle */}
      <div className="mt-4 w-full bg-zinc-700 rounded-full h-2">
        <div 
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
          style={{ 
            width: `${(value1 / (value1 + value2)) * 100}%` 
          }}
        ></div>
      </div>
    </div>
  );
};

/**
 * Composant pour afficher la comparaison d'un champion entre deux joueurs
 */
const ChampionComparisonCard = ({ 
  champion, 
  player1Stats, 
  player2Stats 
}: { 
  champion: string;
  player1Stats: ChampionComparison['player1'];
  player2Stats: ChampionComparison['player2'];
}) => (
  <div className="bg-zinc-900/60 rounded-2xl p-6 border border-white/10 hover:border-purple-500/30 transition-all duration-300 hover:scale-105">
    {/* Nom du champion */}
    <h3 className="text-lg font-bold text-white mb-4 text-center">{champion}</h3>
    
    {/* Statistiques comparées */}
    <div className="grid grid-cols-2 gap-4">
      {/* Statistiques Joueur 1 */}
      <div className="text-center">
        <div className={`text-xl font-bold ${(player1Stats?.winrate || 0) >= 50 ? 'text-green-400' : 'text-red-400'}`}>
          {player1Stats?.winrate || 0}%
        </div>
        <div className="text-gray-400 text-sm">
          {player1Stats?.wins || 0}V {player1Stats?.losses || 0}D
        </div>
        <div className="text-yellow-400 text-sm mt-1">
          KDA {(player1Stats?.kda || 0).toFixed(2)}
        </div>
        <div className="text-gray-500 text-xs mt-1">
          {player1Stats?.games || 0} partie{player1Stats?.games !== 1 ? 's' : ''}
        </div>
      </div>
      
      {/* Statistiques Joueur 2 */}
      <div className="text-center">
        <div className={`text-xl font-bold ${(player2Stats?.winrate || 0) >= 50 ? 'text-green-400' : 'text-red-400'}`}>
          {player2Stats?.winrate || 0}%
        </div>
        <div className="text-gray-400 text-sm">
          {player2Stats?.wins || 0}V {player2Stats?.losses || 0}D
        </div>
        <div className="text-yellow-400 text-sm mt-1">
          KDA {(player2Stats?.kda || 0).toFixed(2)}
        </div>
        <div className="text-gray-500 text-xs mt-1">
          {player2Stats?.games || 0} partie{player2Stats?.games !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  </div>
);

/**
 * Composant pour afficher la carte d'un joueur avec ses informations principales
 */
const PlayerCard = ({ 
  player, 
  stats, 
  isPlayer1 
}: { 
  player: Player;
  stats: PlayerStats;
  isPlayer1: boolean;
}) => (
  <div className={`bg-gradient-to-br ${
    isPlayer1 ? 'from-blue-900/30 to-blue-900/10' : 'from-purple-900/30 to-purple-900/10'
  } rounded-2xl p-6 border-2 ${
    isPlayer1 ? 'border-blue-500' : 'border-purple-500'
  } transition-all duration-300 hover:scale-105`}>
    
    {/* En-tête avec icône et informations du joueur */}
    <div className="flex items-center gap-4 mb-4">
      <img 
        src={`https://ddragon.leagueoflegends.com/cdn/14.2.1/img/profileicon/${player.profile_icon_id}.png`}
        alt={player.summoner_name}
        className="w-16 h-16 rounded-xl border-2 border-white/20"
      />
      <div>
        <h2 className="text-2xl font-bold text-white">{player.summoner_name}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-lg font-semibold text-white">
            {player.rank || 'UNRANKED'} {player.division || ''}
          </span>
          {player.lp !== null && (
            <span className="text-yellow-400 font-bold">{player.lp} LP</span>
          )}
        </div>
        <div className="text-gray-400 text-sm">
          Niveau {player.summoner_level} • {player.region}
        </div>
      </div>
    </div>
    
    {/* Statistiques rapides */}
    <div className="grid grid-cols-3 gap-2 text-center">
      <div>
        <div className="text-green-400 font-bold text-lg">{(stats?.winrate || 0).toFixed(1)}%</div>
        <div className="text-gray-400 text-xs">Winrate</div>
      </div>
      <div>
        <div className="text-yellow-400 font-bold text-lg">{(stats?.average_kda || 0).toFixed(2)}</div>
        <div className="text-gray-400 text-xs">KDA</div>
      </div>
      <div>
        <div className="text-blue-400 font-bold text-lg">{stats?.total_games || 0}</div>
        <div className="text-gray-400 text-xs">Parties</div>
      </div>
    </div>
  </div>
);

/**
 * Composant de recherche de joueurs avec autocomplete
 */
const PlayerSearch = ({ 
  onPlayerSelect, 
  selectedPlayer, 
  placeholder, 
  color = "blue" 
}: { 
  onPlayerSelect: (playerName: string) => void;
  selectedPlayer: string;
  placeholder: string;
  color?: "blue" | "purple";
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  /**
   * Recherche les joueurs correspondant au terme de recherche
   */
  const searchPlayers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
      const response = await fetch(`${backendUrl}/players/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Erreur recherche:", error);
    } finally {
      setLoading(false);
    }
  };

  // Recherche avec debounce pour éviter trop d'appels API
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      searchPlayers(searchTerm);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  /**
   * Gère la sélection d'un joueur dans les résultats
   */
  const handleSelect = (player: Player) => {
    onPlayerSelect(player.summoner_name);
    setSearchTerm(player.summoner_name);
    setIsOpen(false);
    setSearchResults([]);
  };

  return (
    <div className="relative">
      {/* Champ de recherche */}
      <input
        type="text"
        value={selectedPlayer || searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
          if (!e.target.value) onPlayerSelect("");
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        placeholder={placeholder}
        className={`w-full bg-zinc-800 border-2 ${
          color === 'blue' ? 'border-blue-500 focus:ring-blue-500/20' : 'border-purple-500 focus:ring-purple-500/20'
        } rounded-lg px-4 py-3 text-white focus:ring-2 transition-all placeholder-gray-500`}
      />
      
      {/* Dropdown des résultats */}
      {isOpen && (searchTerm.length > 0 || searchResults.length > 0) && (
        <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-gray-600 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-400">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : searchResults.length > 0 ? (
            searchResults.map((player) => (
              <button
                key={player.id}
                onClick={() => handleSelect(player)}
                className="w-full p-3 text-left hover:bg-zinc-700 transition-colors border-b border-zinc-600 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <img 
                    src={`https://ddragon.leagueoflegends.com/cdn/14.2.1/img/profileicon/${player.profile_icon_id}.png`}
                    alt={player.summoner_name}
                    className="w-8 h-8 rounded"
                  />
                  <div>
                    <div className="text-white font-semibold">{player.summoner_name}</div>
                    <div className="text-gray-400 text-sm">
                      {player.rank || 'UNRANKED'} {player.division || ''} • {player.lp || 0} LP
                    </div>
                  </div>
                </div>
              </button>
            ))
          ) : searchTerm.length >= 2 ? (
            <div className="p-4 text-center text-gray-400">
              Aucun joueur trouvé pour "{searchTerm}"
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// 🔹 PAGE PRINCIPALE DE COMPARAISON
// =============================================================================

export default function VersusPage() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer1, setSelectedPlayer1] = useState<string>("");
  const [selectedPlayer2, setSelectedPlayer2] = useState<string>("");
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Charge la liste initiale des joueurs pour les suggestions
   */
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
        const response = await fetch(`${backendUrl}/players`);
        const data = await response.json();
        setPlayers(data);
      } catch (error) {
        console.error("Erreur chargement joueurs:", error);
      }
    };
    
    fetchPlayers();
  }, []);

  /**
   * Compare les deux joueurs sélectionnés
   */
  const comparePlayers = async () => {
    if (!selectedPlayer1 || !selectedPlayer2) {
      setError("Veuillez sélectionner deux joueurs");
      return;
    }

    if (selectedPlayer1 === selectedPlayer2) {
      setError("Veuillez sélectionner deux joueurs différents");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
      const response = await fetch(
        `${backendUrl}/players/compare?player1=${encodeURIComponent(selectedPlayer1)}&player2=${encodeURIComponent(selectedPlayer2)}`
      );
      
      if (!response.ok) {
        throw new Error("Erreur lors de la comparaison des joueurs");
      }
      
      const comparisonData = await response.json();
      setComparisonData(comparisonData);
      
    } catch (error: any) {
      console.error("Erreur comparaison:", error);
      setError(error.message || "Une erreur est survenue lors de la comparaison");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Réinitialise la comparaison
   */
  const resetComparison = () => {
    setSelectedPlayer1("");
    setSelectedPlayer2("");
    setComparisonData(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-950 text-gray-200 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* ========================================================================= */}
        {/* 🔹 EN-TÊTE DE LA PAGE */}
        {/* ========================================================================= */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-4">
          {/* Bouton retour */}
          <button
            onClick={() => navigate("/ranking")}
            className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-semibold transition-all duration-300 hover:scale-105 flex items-center gap-2 group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
            Retour au classement
          </button>
          
          {/* Titre principal */}
          <h1 className="text-3xl md:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 text-center lg:text-left">
            🆚 Arène de Comparaison
          </h1>

          {/* Bouton réinitialiser */}
          {comparisonData && (
            <button
              onClick={resetComparison}
              className="px-5 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 font-semibold transition-all duration-300 hover:scale-105"
            >
              Nouvelle comparaison
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 🔹 SECTION DE SÉLECTION DES JOUEURS */}
        {/* ========================================================================= */}
        <div className="bg-zinc-900/60 rounded-2xl p-6 border border-white/10 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">⚔️ Choisissez vos combattants</h2>
          
          {/* Sélection des joueurs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Sélection Joueur 1 */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                🔵 Joueur 1
              </label>
              <PlayerSearch
                onPlayerSelect={setSelectedPlayer1}
                selectedPlayer={selectedPlayer1}
                placeholder="Rechercher un joueur..."
                color="blue"
              />
            </div>

            {/* Sélection Joueur 2 */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                🟣 Joueur 2
              </label>
              <PlayerSearch
                onPlayerSelect={setSelectedPlayer2}
                selectedPlayer={selectedPlayer2}
                placeholder="Rechercher un joueur..."
                color="purple"
              />
            </div>
          </div>

          {/* Messages d'erreur */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300">
              ⚠️ {error}
            </div>
          )}

          {/* Bouton de comparaison */}
          <button
            onClick={comparePlayers}
            disabled={!selectedPlayer1 || !selectedPlayer2 || loading}
            className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg font-bold"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Analyse en cours...
              </>
            ) : (
              <>
                ⚔️ Lancer la comparaison
              </>
            )}
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 🔹 RÉSULTATS DE LA COMPARAISON */}
        {/* ========================================================================= */}
        {comparisonData && (
          <div className="space-y-8 animate-fade-in">
            
            {/* --------------------------------------------------------------------- */}
            {/* 🎯 EN-TÊTE DES JOUEURS */}
            {/* --------------------------------------------------------------------- */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                👥 Profils des Combattants
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PlayerCard 
                  player={comparisonData.player1} 
                  stats={comparisonData.stats1}
                  isPlayer1={true}
                />
                <PlayerCard 
                  player={comparisonData.player2} 
                  stats={comparisonData.stats2}
                  isPlayer1={false}
                />
              </div>
            </section>

            {/* --------------------------------------------------------------------- */}
            {/* 📊 STATISTIQUES PRINCIPALES */}
            {/* --------------------------------------------------------------------- */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                📊 Statistiques Globales
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatComparisonCard 
                  title="Winrate"
                  value1={comparisonData.stats1.winrate || 0}
                  value2={comparisonData.stats2.winrate || 0}
                  isPercentage={true}
                  isBetter="higher"
                />
                
                <StatComparisonCard 
                  title="KDA Moyen"
                  value1={comparisonData.stats1.average_kda || 0}
                  value2={comparisonData.stats2.average_kda || 0}
                  isBetter="higher"
                />
                
                <StatComparisonCard 
                  title="Kills/Match"
                  value1={comparisonData.stats1.average_kills || 0}
                  value2={comparisonData.stats2.average_kills || 0}
                  isBetter="higher"
                />
                
                <StatComparisonCard 
                  title="Morts/Match"
                  value1={comparisonData.stats1.average_deaths || 0}
                  value2={comparisonData.stats2.average_deaths || 0}
                  isBetter="lower"
                />
              </div>
            </section>

            {/* --------------------------------------------------------------------- */}
            {/* 🏆 COMPARAISON DES CHAMPIONS */}
            {/* --------------------------------------------------------------------- */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                🏆 Champions en Commun
              </h2>
              
              {comparisonData.championComparison.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {comparisonData.championComparison.map((champData, index) => (
                    <ChampionComparisonCard
                      key={`${champData.champion}-${index}`}
                      champion={champData.champion}
                      player1Stats={champData.player1}
                      player2Stats={champData.player2}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-zinc-900/30 rounded-2xl border border-dashed border-gray-600">
                  <p className="text-gray-500 text-lg">Aucun champion en commun</p>
                  <p className="text-gray-400 text-sm mt-2">
                    Les joueurs n'ont pas joué les mêmes champions récemment
                  </p>
                </div>
              )}
            </section>

            {/* --------------------------------------------------------------------- */}
            {/* 📈 ANALYSE AVANCÉE */}
            {/* --------------------------------------------------------------------- */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                📈 Analyse Détaillée
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Rôle préféré */}
                <div className="bg-zinc-900/60 rounded-2xl p-6 border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4">🎯 Rôle Préféré</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-blue-500/10 rounded-lg">
                      <span className="text-gray-400">Joueur 1:</span>
                      <span className="text-blue-300 font-semibold">
                        {comparisonData.stats1.favorite_role || "Inconnu"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-purple-500/10 rounded-lg">
                      <span className="text-gray-400">Joueur 2:</span>
                      <span className="text-purple-300 font-semibold">
                        {comparisonData.stats2.favorite_role || "Inconnu"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Meilleur champion */}
                <div className="bg-zinc-900/60 rounded-2xl p-6 border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4">⭐ Meilleur Champion</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-blue-500/10 rounded-lg">
                      <span className="text-gray-400">Joueur 1:</span>
                      <span className="text-blue-300 font-semibold">
                        {comparisonData.stats1.best_champion || "Aucun"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-purple-500/10 rounded-lg">
                      <span className="text-gray-400">Joueur 2:</span>
                      <span className="text-purple-300 font-semibold">
                        {comparisonData.stats2.best_champion || "Aucun"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* --------------------------------------------------------------------- */}
            {/* 🏅 RÉSULTAT FINAL */}
            {/* --------------------------------------------------------------------- */}
            <section>
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-8 border border-white/20 text-center">
                <h2 className="text-2xl font-bold text-white mb-4">🏅 Verdict Final</h2>
                <div className="text-lg text-gray-300">
                  {comparisonData.stats1.winrate > comparisonData.stats2.winrate ? (
                    <span>
                      <span className="text-blue-300 font-bold">{comparisonData.player1.summoner_name}</span> a un meilleur winrate global !
                    </span>
                  ) : comparisonData.stats2.winrate > comparisonData.stats1.winrate ? (
                    <span>
                      <span className="text-purple-300 font-bold">{comparisonData.player2.summoner_name}</span> domine avec son winrate !
                    </span>
                  ) : (
                    <span>Les deux joueurs sont à égalité sur le winrate !</span>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 🔹 ÉTAT INITIAL - MESSAGE D'ACCUEIL */}
        {/* ========================================================================= */}
        {!comparisonData && !loading && (
          <div className="text-center py-16 bg-zinc-900/30 rounded-2xl border border-dashed border-gray-600">
            <div className="text-6xl mb-4">⚔️</div>
            <h2 className="text-2xl font-bold text-white mb-4">Prêt pour le combat ?</h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Sélectionnez deux joueurs du classement pour comparer leurs performances, 
              leurs champions préférés et déterminer qui domine l'arène.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}