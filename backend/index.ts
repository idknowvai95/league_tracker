import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import 'dotenv/config';
import { createClient } from "@supabase/supabase-js";

// =============================================================================
// 🔹 INITIALISATION EXPRESS ET CONFIGURATION
// =============================================================================

const app = express();

// =============================================================================
// 🔹 CONFIGURATION CORS POUR NETLIFY + RAILWAY
// =============================================================================

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://bejewelled-pasca-336e8b.netlify.app',        // ⬅️ REMPLACEZ PAR VOTRE URL NETLIFY
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080'
    ];
    
    // En production, autoriser Railway
    if (process.env.NODE_ENV === 'production') {
      allowedOrigins.push(/\.railway\.app$/);
    }
    
    if (!origin || allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') return allowed === origin;
      return allowed.test(origin);
    })) {
      callback(null, true);
    } else {
      console.log('🚫 CORS bloqué:', origin);
      callback(new Error('CORS non autorisé'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Riot-Token']
};

app.use(cors(corsOptions));
app.use(express.json());

// Middleware pour logger les requêtes CORS
app.use((req, res, next) => {
  console.log('🌐 Requête reçue:', {
    method: req.method,
    origin: req.headers.origin,
    path: req.path
  });
  next();
});

// =============================================================================
// 🔹 CONFIGURATION SUPABASE
// =============================================================================

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Récupération de la clé API Riot
const RIOT_API_KEY = process.env.RIOT_API_KEY!;

// Vérification que la clé API Riot est bien configurée
if (!RIOT_API_KEY) {
  console.error("❌ ERREUR : Aucune clé Riot API trouvée dans le .env");
  process.exit(1);
}

// =============================================================================
// 🔹 CONSTANTES GLOBALES
// =============================================================================

const RANKED_SOLO_QUEUE_ID = 420; // ID pour les parties Ranked Solo/Duo

// =============================================================================
// 🔹 CLASSES D'ERREUR PERSONNALISÉES
// =============================================================================

/**
 * Erreur spécifique pour les problèmes d'API Riot
 */
class RiotAPIError extends Error {
  constructor(message: string, public statusCode: number, public riotErrorCode?: string) {
    super(message);
    this.name = "RiotAPIError";
  }
}

/**
 * Erreur pour les problèmes de validation des paramètres
 */
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// =============================================================================
// 🔹 FONCTIONS UTILITAIRES
// =============================================================================

/**
 * 🔄 Délai artificiel pour respecter les rate limits de l'API Riot
 * @param ms - Temps d'attente en millisecondes
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 🛡️ Appel sécurisé à l'API Riot avec gestion des rate limits
 * @param url - URL de l'API à appeler
 * @param options - Options supplémentaires pour fetch
 * @returns Réponse de l'API
 */
const callRiotAPI = async (url: string, options: any = {}) => {
  const response = await fetch(url, {
    headers: { "X-Riot-Token": RIOT_API_KEY },
    ...options
  });
  
  // Gérer les rate limits (429 = Too Many Requests)
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || 1;
    console.log(`⏳ Rate limit atteint, attente de ${retryAfter}s`);
    await delay(Number(retryAfter) * 1000);
    return callRiotAPI(url, options); // Retry après l'attente
  }
  
  return response;
};

/**
 * 🧹 Nettoie et valide le nom du summoner
 * @param name - Nom du summoner à nettoyer
 * @returns Nom nettoyé et sécurisé
 */
const sanitizeSummonerName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9\u0080-\uFFFF _\-.#]/g, '').trim();
};

/**
 * 🔍 Parse le Riot ID (nom#tag) en composants séparés
 * @param summonerName - Riot ID complet ou nom seul
 * @param tagLine - Tag optionnel si fourni séparément
 * @returns Objet avec nom nettoyé et tag
 */
const parseRiotId = (summonerName: string, tagLine?: string) => {
  let cleanName: string;
  let finalTagLine: string;
  
  if (summonerName.includes("#")) {
    [cleanName, finalTagLine] = summonerName.split("#");
  } else if (tagLine) {
    cleanName = summonerName;
    finalTagLine = tagLine;
  } else {
    cleanName = summonerName;
    finalTagLine = "EUW"; // Valeur par défaut
  }
  
  return {
    cleanName: sanitizeSummonerName(cleanName),
    finalTagLine: sanitizeSummonerName(finalTagLine)
  };
};

/**
 * ⚡ Traite les matchs par batch pour optimiser les performances
 * @param matchIds - Liste des IDs de match à traiter
 * @param region - Région du joueur
 * @param puuid - PUUID du joueur
 * @returns Résultats du traitement
 */
const processMatchesInBatches = async (matchIds: string[], region: string, puuid: string) => {
  const BATCH_SIZE = 10; // Éviter trop d'appaux simultanés
  const results = [];
  
  for (let i = 0; i < matchIds.length; i += BATCH_SIZE) {
    const batch = matchIds.slice(i, i + BATCH_SIZE);
    console.log(`🔄 Traitement du batch ${i/BATCH_SIZE + 1}/${Math.ceil(matchIds.length/BATCH_SIZE)}`);
    
    const batchPromises = batch.map(async (matchId) => {
      try {
        const matchDetailUrl = `https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`;
        const matchDetailResponse = await callRiotAPI(matchDetailUrl);
        
        if (matchDetailResponse.ok) {
          const matchData = await matchDetailResponse.json();
          
          // Préparer les données pour la BDD
          const matchForDb = {
            match_id: matchId,
            puuid: puuid,
            region: region,
            data: matchData,
            game_creation: matchData.info.gameCreation,
            game_duration: matchData.info.gameDuration,
            game_mode: matchData.info.gameMode,
            queue_id: matchData.info.queueId, // 🔥 IMPORTANT: Sauvegarder le queue_id
            created_at: new Date().toISOString()
          };
          
          // Sauvegarder en base
          const { error: insertError } = await supabase
            .from("matches")
            .upsert(matchForDb, { onConflict: "match_id" });
          
          if (insertError) {
            console.log(`❌ Erreur sauvegarde match ${matchId}:`, insertError);
            return { success: false, matchId, error: insertError.message };
          } else {
            console.log(`✅ Match ${matchId} sauvegardé (queue: ${matchData.info.queueId})`);
            return { success: true, matchId };
          }
        } else {
          return { success: false, matchId, error: `HTTP ${matchDetailResponse.status}` };
        }
      } catch (error: any) {
        console.log(`💥 Erreur sur match ${matchId}:`, error);
        return { success: false, matchId, error: error.message };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Pause entre les batches pour respecter les rate limits
    if (i + BATCH_SIZE < matchIds.length) {
      await delay(1000);
    }
  }
  
  return results;
};

// =============================================================================
// 🔹 MIDDLEWARES DE VALIDATION
// =============================================================================

/**
 * 🛡️ Middleware de validation pour les paramètres joueur
 * Vérifie que summonerName et region sont présents et valides
 */
const validatePlayerParams = (req: any, res: any, next: any) => {
  const { summonerName, region } = req.body;
  
  if (!summonerName) {
    return res.status(400).json({ 
      error: "Le paramètre summonerName est requis" 
    });
  }
  
  if (!region) {
    return res.status(400).json({ 
      error: "Le paramètre region est requis" 
    });
  }
  
  const validRegions = ['euw1', 'na1', 'kr', 'eun1', 'br1', 'la1', 'la2', 'oc1', 'ru', 'tr1', 'jp1'];
  if (!validRegions.includes(region.toLowerCase())) {
    return res.status(400).json({ 
      error: "Région invalide", 
      validRegions,
      received: region
    });
  }
  
  next();
};

/**
 * 🛡️ Middleware de validation pour les limites de matchs
 * Garantit que la limite est un nombre valide entre 1 et 100
 */
const validateMatchLimit = (req: any, res: any, next: any) => {
  const MAX_MATCH_LIMIT = 100;
  let { limit = 20 } = req.query;
  
  limit = Math.min(parseInt(limit as string), MAX_MATCH_LIMIT);
  if (isNaN(limit) || limit <= 0) {
    return res.status(400).json({ 
      error: "Le paramètre limit doit être un nombre positif",
      maxLimit: MAX_MATCH_LIMIT
    });
  }
  
  req.validatedLimit = limit;
  next();
};

// =============================================================================
// 🔹 ROUTES PRINCIPALES
// =============================================================================

// =============================================================================
// ✅ ROUTE : Récupérer tous les joueurs
// =============================================================================
app.get("/players", async (req, res) => {
  try {
    console.log("🔍 Récupération de tous les joueurs...");
    
    const { data: players, error } = await supabase
      .from("players")
      .select("*")
      .order("last_updated", { ascending: false });

    if (error) {
      console.log("❌ Erreur récupération joueurs:", error);
      throw error;
    }

    console.log(`✅ ${players?.length || 0} joueur(s) trouvé(s)`);
    res.json(players || []);
    
  } catch (err: any) {
    console.error("💥 Erreur route /players:", err);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des joueurs" });
  }
});

// =============================================================================
// ✅ ROUTE : Mettre à jour les données d'un joueur
// =============================================================================
app.post("/update-player", validatePlayerParams, async (req, res) => {
  const { summonerName, region, tagLine } = req.body;
  
  console.log("\n🎯 NOUVELLE REQUÊTE ==================================");
  console.log("🔍 REQUÊTE REÇUE:", { summonerName, region, tagLine });
  
  try {
    // Parse le Riot ID
    const { cleanName, finalTagLine } = parseRiotId(summonerName, tagLine);
    console.log("🎯 Riot ID analysé:", cleanName, "#", finalTagLine);

    // =========================================================================
    // ✅ ÉTAPE 1 : VÉRIFICATION EN BASE DE DONNÉES (CACHE)
    // =========================================================================
    
    /**
     * Vérifie si les données sont récentes (moins de 5 minutes)
     * @param lastUpdated - Date de dernière mise à jour
     * @returns true si les données sont récentes
     */
    const isDataRecent = (lastUpdated: string) => {
      const lastUpdate = new Date(lastUpdated);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
      return diffMinutes < 5; // Cache de 5 minutes
    };

    // Recherche du joueur dans la base de données
    const { data: existingPlayer, error: dbError } = await supabase
      .from("players")
      .select("*")
      .ilike("summoner_name", cleanName)
      .single();

    // Si le joueur existe et que ses données sont récentes, on les retourne directement
    if (existingPlayer && isDataRecent(existingPlayer.last_updated)) {
      console.log("✅ Données récupérées depuis la BDD (cache frais)");
      
      // Formatage des données pour le frontend
      const frontendPlayer = {
        puuid: existingPlayer.puuid,
        profile_icon_id: existingPlayer.profile_icon_id,
        summoner_name: existingPlayer.summoner_name,
        summoner_level: existingPlayer.summoner_level,
        rank: existingPlayer.rank,
        division: existingPlayer.division,
        lp: existingPlayer.lp,
        source: "cache" // Indique que les données viennent du cache
      };
      
      return res.json(frontendPlayer);
    }

    console.log("🔍 Données non trouvées en BDD ou obsolètes, appel API Riot...");

    // =========================================================================
    // ✅ ÉTAPE 2 : APPEL API RIOT (SI DONNÉES ABSENTES OU OBSOLÈTES)
    // =========================================================================

    // Appel à l'API Riot Account pour récupérer les informations de base du compte
    const accountUrl = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(cleanName)}/${encodeURIComponent(finalTagLine)}`;
    console.log(`🔗 URL Account API: ${accountUrl}`);

    const accountRes = await callRiotAPI(accountUrl);

    console.log("📊 Account API status:", accountRes.status);

    // Gestion des erreurs de l'API Account
    if (!accountRes.ok) {
      const errorText = await accountRes.text();
      console.log("❌ Account API error details:", errorText);
      
      if (accountRes.status === 404) {
        throw new RiotAPIError(
          `Joueur "${cleanName}#${finalTagLine}" introuvable - Vérifiez le Riot ID et le tag`,
          404
        );
      } else if (accountRes.status === 403) {
        throw new RiotAPIError("Clé API Riot invalide ou expirée", 403);
      } else {
        throw new RiotAPIError(
          `Erreur API Riot: ${accountRes.status} - ${errorText}`,
          accountRes.status
        );
      }
    }
    
    // Extraction des données du compte Riot
    const accountData = await accountRes.json();
    const puuid = accountData.puuid; // Identifiant unique du joueur
    const actualGameName = accountData.gameName; // Nom exact du joueur
    const actualTagLine = accountData.tagLine; // Tag exact du joueur

    console.log("✅ PUUID récupéré:", puuid);
    console.log("✅ Nom exact:", actualGameName);
    console.log("✅ Tag exact:", actualTagLine);

    // =========================================================================
    // ✅ ÉTAPE 3 : RÉCUPÉRATION DES DONNÉES SUMMONER (LOLL)
    // =========================================================================

    // Appel à l'API League of Legends pour récupérer les données du summoner
    const summRes = await callRiotAPI(
      `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`
    );
    
    if (!summRes.ok) {
      throw new RiotAPIError(
        "Summoner introuvable - Vérifiez la région ou les permissions API",
        summRes.status
      );
    }
    
    const summonerData = await summRes.json();
    console.log("✅ Données Summoner:", {
      name: summonerData.name,
      level: summonerData.summonerLevel,
      icon: summonerData.profileIconId
    });

    // =========================================================================
    // ✅ ÉTAPE 4 : RÉCUPÉRATION DES DONNÉES DE RANG (COMPÉTITIF)
    // =========================================================================

    console.log("🎯 Récupération des données de rang...");

    let rank: string | null = null;
    let division: number | null = null;
    let lp: number | null = null;

    try {
      // Appel à l'API League pour récupérer le rang du joueur
      const leagueUrl = `https://${region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${summonerData.puuid}`;
      console.log("🔗 URL API League:", leagueUrl);
      
      const leagueRes = await callRiotAPI(leagueUrl);

      console.log("📊 Status HTTP League:", leagueRes.status);

      if (leagueRes.ok) {
        const leagueData = await leagueRes.json();
        console.log("📋 Données brutes API League:", JSON.stringify(leagueData, null, 2));
        
        if (leagueData && leagueData.length > 0) {
          console.log(`✅ ${leagueData.length} entrée(s) de rang trouvée(s)`);
          
          // Affichage détaillé de chaque entrée de rang
          leagueData.forEach((entry: any, index: number) => {
            console.log(`📖 Entrée ${index + 1}:`, {
              queueType: entry.queueType,
              tier: entry.tier,
              rank: entry.rank,
              leaguePoints: entry.leaguePoints,
              wins: entry.wins,
              losses: entry.losses
            });
          });
          
          // Recherche spécifique du rang en SoloQ (5v5)
          const rankedSolo = leagueData.find((entry: any) => entry.queueType === "RANKED_SOLO_5x5");
          
          if (rankedSolo) {
            console.log("🏆 RANG SOLO TROUVÉ:", rankedSolo);
            rank = rankedSolo.tier; // Ex: "GOLD", "PLATINUM"
            
            // Conversion des chiffres romains en chiffres arabes (I -> 1, II -> 2, etc.)
            const romanToNumber: { [key: string]: number } = {
              'I': 1, 'II': 2, 'III': 3, 'IV': 4
            };
            division = romanToNumber[rankedSolo.rank] || null;
            lp = rankedSolo.leaguePoints; // Points de ligue
            
            console.log(`🎯 RANG FINAL: ${rank} ${rankedSolo.rank} (Division: ${division}) - LP: ${lp}`);
          } else {
            console.log("❌ Aucune entrée RANKED_SOLO_5x5 trouvée");
          }
        } else {
          console.log("ℹ️ Aucune donnée de rang - Joueur non classé");
        }
      } else if (leagueRes.status === 403) {
        console.log("🔒 ERREUR 403: Permission API League refusée");
      } else {
        console.log("❌ Erreur API League - Status:", leagueRes.status);
      }
    } catch (err) {
      console.log("💥 Erreur lors de l'appel API League:", err);
    }

    console.log("📝 VALEURS FINALES:", { rank, division, lp });

    // =========================================================================
    // ✅ ÉTAPE 5 : PRÉPARATION ET SAUVEGARDE EN BASE DE DONNÉES
    // =========================================================================

    // Formatage des données pour la base de données
    const player = {
      summoner_name: actualGameName, // Utiliser le nom exact de l'API
      puuid: summonerData.puuid, // Identifiant unique Riot
      summoner_id: summonerData.id, // ID summoner
      profile_icon_id: summonerData.profileIconId, // ID de l'icône de profil
      summoner_level: summonerData.summonerLevel, // Niveau du summoner
      rank: rank, // Rang (Tier)
      division: division, // Division (1-4)
      lp: lp, // Points de ligue
      region: region.toLowerCase(), // Région du joueur
      last_updated: new Date().toISOString() // Horodatage de la mise à jour
    };

    // Sauvegarde ou mise à jour du joueur en base de données
    // 'upsert' signifie : créer si n'existe pas, mettre à jour si existe déjà
    // 'onConflict: "puuid"' permet de gérer les conflits sur l'identifiant unique
    const { error: upsertError } = await supabase
      .from("players")
      .upsert(player, { onConflict: "puuid" });

    if (upsertError) {
      throw new Error(`Erreur base de données: ${upsertError.message}`);
    }

    // =========================================================================
    // ✅ ÉTAPE 6 : PRÉPARATION DE LA RÉPONSE POUR LE FRONTEND
    // =========================================================================

    // Formatage des données pour l'interface utilisateur
    const frontendPlayer = {
      puuid: summonerData.puuid,
      profile_icon_id: summonerData.profileIconId,
      summoner_name: actualGameName, // Utiliser le nom exact
      summoner_level: summonerData.summonerLevel,
      rank: rank,
      division: division,
      lp: lp,
      source: "api" // Indique que les données viennent de l'API Riot
    };

    console.log("✅ Joueur envoyé au frontend (depuis API):", frontendPlayer);
    res.json(frontendPlayer);
    
  } catch (err: any) {
    console.error("💥 Erreur serveur :", err.message);
    
    // Gestion spécifique des erreurs RiotAPI
    if (err instanceof RiotAPIError) {
      res.status(err.statusCode).json({ 
        error: err.message,
        code: err.riotErrorCode 
      });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// =============================================================================
// ✅ ROUTE : Récupérer un joueur spécifique
// =============================================================================
app.get("/player/:summonerName", async (req, res) => {
  try {
    const { summonerName } = req.params;
    console.log(`🔍 Recherche du joueur: ${summonerName}`);
    
    // Recherche du joueur dans la base de données (insensible à la casse)
    const { data: player, error } = await supabase
      .from("players")
      .select("*")
      .ilike("summoner_name", summonerName)
      .single();

    if (error) {
      console.log("❌ Joueur non trouvé:", error);
      return res.status(404).json({ error: "Joueur non trouvé" });
    }

    console.log(`✅ Joueur trouvé: ${player.summoner_name}`);
    res.json(player);
    
  } catch (err: any) {
    console.error("💥 Erreur route /player/:summonerName:", err);
    res.status(500).json({ error: "Erreur serveur lors de la recherche du joueur" });
  }
});

// =============================================================================
// ✅ ROUTE AMÉLIORÉE : Récupérer SEULEMENT les matchs RANKED SOLO
// =============================================================================
app.get("/player/:summonerName/matches", validateMatchLimit, async (req, res) => {
  try {
    const { summonerName } = req.params;
    const { update = false } = req.query;
    const limit = req.validatedLimit;
    
    console.log(`🔍 Recherche des matchs RANKED SOLO de: ${summonerName}, limite: ${limit}`);

    // 1. Récupérer le joueur pour avoir son PUUID
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("puuid, summoner_name, region, last_updated")
      .ilike("summoner_name", summonerName)
      .single();

    if (playerError || !player) {
      console.log("❌ Joueur non trouvé pour les matchs");
      return res.status(404).json({ error: "Joueur non trouvé" });
    }

    console.log(`🎯 Recherche des matchs RANKED SOLO pour PUUID: ${player.puuid}`);

    // 2. Récupérer UNIQUEMENT les matchs RANKED SOLO depuis la BDD
    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("match_id, data, game_creation, game_duration, game_mode, created_at, queue_id")
      .eq("puuid", player.puuid)
      .eq("queue_id", RANKED_SOLO_QUEUE_ID) // 🔥 FILTRE RANKED SOLO SEULEMENT
      .order("game_creation", { ascending: false })
      .limit(limit);

    if (matchesError) {
      console.log("❌ Erreur récupération matchs:", matchesError);
      throw matchesError;
    }

    console.log(`✅ ${matches?.length || 0} match(s) RANKED SOLO trouvé(s) en BDD`);

    res.json({
      matches: matches || [],
      count: matches?.length || 0,
      player: player.summoner_name,
      queue_type: "RANKED_SOLO",
      last_updated: matches && matches.length > 0 ? matches[0].created_at : null
    });
    
  } catch (err: any) {
    console.error("💥 Erreur route /player/:summonerName/matches:", err);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// ✅ ROUTE FINALE : Récupérer et stocker les matchs
// =============================================================================
app.get("/player/:summonerName/matches/update", validateMatchLimit, async (req, res) => {
  const { summonerName } = req.params;
  const limit = req.validatedLimit;

  console.log(`\n🎯 DÉBUT RÉCUPÉRATION MATCHS ==========================`);
  console.log(`🔍 Joueur: ${summonerName}, Limit: ${limit}`);

  try {
    // 1. Récupérer le joueur depuis la BDD
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("puuid, summoner_name, region")
      .ilike("summoner_name", summonerName)
      .single();

    if (playerError || !player) {
      console.log("❌ Joueur non trouvé:", playerError);
      return res.status(404).json({ error: "Joueur non trouvé" });
    }

    console.log(`✅ Joueur trouvé: ${player.summoner_name} (PUUID: ${player.puuid})`);

    // 2. Déterminer le cluster régional pour Match V5
    const getRegionalCluster = (platformRegion: string) => {
      const clusterMap: { [key: string]: string } = {
        'euw1': 'europe',
        'eun1': 'europe', 
        'na1': 'americas',
        'br1': 'americas',
        'la1': 'americas',
        'la2': 'americas',
        'kr': 'asia',
        'jp1': 'asia',
        'oc1': 'asia',
        'ru': 'europe',
        'tr1': 'europe'
      };
      return clusterMap[platformRegion.toLowerCase()] || 'europe';
    };

    const regionalCluster = getRegionalCluster(player.region);
    console.log(`🌍 Cluster régional Match V5: ${regionalCluster} (depuis: ${player.region})`);

    // 3. Appeler l'API Riot Match V5 pour les IDs de match
    const matchIdsUrl = `https://${regionalCluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${player.puuid}/ids?start=0&count=${limit}`;
    console.log(`📡 URL Match IDs: ${matchIdsUrl}`);
    
    const matchIdsResponse = await callRiotAPI(matchIdsUrl);

    if (!matchIdsResponse.ok) {
      const errorText = await matchIdsResponse.text();
      console.log("❌ Erreur API Match IDs:", matchIdsResponse.status, errorText);
      throw new RiotAPIError(
        `Erreur API Match V5: ${matchIdsResponse.status}`,
        matchIdsResponse.status
      );
    }

    const matchIds = await matchIdsResponse.json();
    console.log(`✅ ${matchIds.length} IDs de match récupérés:`, matchIds);

    // 4. Traiter chaque match
    console.log("📥 Récupération des détails des matchs...");
    const savedMatches = [];
    const failedMatches = [];

    for (const matchId of matchIds) {
      try {
        const matchDetailUrl = `https://${regionalCluster}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
        console.log(`🔍 Récupération match: ${matchId}`);
        
        const matchDetailResponse = await callRiotAPI(matchDetailUrl);

        if (!matchDetailResponse.ok) {
          console.log(`❌ Erreur détail match ${matchId}:`, matchDetailResponse.status);
          failedMatches.push({ matchId, error: `HTTP ${matchDetailResponse.status}` });
          continue;
        }

        const matchData = await matchDetailResponse.json();
        
        // Préparer les données pour la BDD avec queue_id
        const matchForDb = {
          match_id: matchId,
          puuid: player.puuid,
          region: player.region,
          data: matchData,
          game_creation: matchData.info.gameCreation,
          game_duration: matchData.info.gameDuration,
          game_mode: matchData.info.gameMode,
          queue_id: matchData.info.queueId, // 🔥 SAUVEGARDER LE QUEUE_ID
          created_at: new Date().toISOString()
        };

        console.log(`💾 Sauvegarde match ${matchId} avec queue_id: ${matchData.info.queueId}`);

        // Sauvegarder en base
        const { error: insertError } = await supabase
          .from("matches")
          .upsert(matchForDb, { onConflict: "match_id" });

        if (insertError) {
          console.log(`❌ Erreur sauvegarde match ${matchId}:`, insertError);
          failedMatches.push({ matchId, error: insertError.message });
        } else {
          console.log(`✅ Match ${matchId} sauvegardé (queue: ${matchData.info.queueId})`);
          savedMatches.push(matchId);
        }

        // Délai pour respecter les rate limits
        await delay(1200);

      } catch (matchError: any) {
        console.log(`💥 Erreur sur match ${matchId}:`, matchError);
        failedMatches.push({ matchId, error: matchError.message });
      }
    }

    // 5. Réponse finale
    console.log(`🎯 RÉSULTAT: ${savedMatches.length} matchs sauvegardés, ${failedMatches.length} échecs`);
    
    res.json({
      success: true,
      player: player.summoner_name,
      region: player.region,
      total_processed: matchIds.length,
      saved: savedMatches.length,
      failed: failedMatches.length,
      saved_matches: savedMatches,
      failed_matches: failedMatches,
      message: `${savedMatches.length} matchs sauvegardés avec succès dans la base de données`
    });

  } catch (err: any) {
    console.error("💥 Erreur globale récupération matchs:", err);
    
    if (err instanceof RiotAPIError) {
      res.status(err.statusCode).json({ 
        error: err.message,
        details: "Erreur API Riot Match V5" 
      });
    } else {
      res.status(500).json({ 
        error: err.message,
        details: "Erreur interne du serveur" 
      });
    }
  }
});
// =============================================================================
// ✅ ROUTE : Récupérer les joueurs pour l'autocomplete
// =============================================================================
app.get("/players/search", async (req, res) => {
  try {
    const { q = "" } = req.query;
    
    console.log(`🔍 Recherche de joueurs: "${q}"`);
    
    const { data: players, error } = await supabase
      .from("players")
      .select("id, summoner_name, profile_icon_id, rank, division, lp, region")
      .ilike("summoner_name", `%${q}%`)
      .order("summoner_name")
      .limit(10);

    if (error) {
      console.log("❌ Erreur recherche joueurs:", error);
      throw error;
    }

    console.log(`✅ ${players?.length || 0} joueur(s) trouvé(s)`);
    res.json(players || []);
    
  } catch (err: any) {
    console.error("💥 Erreur route /players/search:", err);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// ✅ ROUTE : Comparaison de deux joueurs
// =============================================================================
app.get("/players/compare", async (req, res) => {
  try {
    const { player1, player2 } = req.query;
    
    if (!player1 || !player2) {
      return res.status(400).json({ 
        error: "Les paramètres player1 et player2 sont requis" 
      });
    }

    console.log(`🆚 Comparaison: ${player1} vs ${player2}`);

    // Récupérer les données des deux joueurs en parallèle
    const [player1Data, player2Data, stats1Data, stats2Data] = await Promise.all([
      supabase.from("players").select("*").ilike("summoner_name", player1).single(),
      supabase.from("players").select("*").ilike("summoner_name", player2).single(),
      supabase.from("matches").select("data").eq("puuid", 
        (await supabase.from("players").select("puuid").ilike("summoner_name", player1).single()).data.puuid
      ),
      supabase.from("matches").select("data").eq("puuid", 
        (await supabase.from("players").select("puuid").ilike("summoner_name", player2).single()).data.puuid
      )
    ]);

    // Vérifier que les joueurs existent
    if (!player1Data.data || !player2Data.data) {
      return res.status(404).json({ 
        error: "Un ou plusieurs joueurs non trouvés" 
      });
    }

    // Calculer les statistiques avancées
    const stats1 = calculateAdvancedStats(stats1Data.data || [], player1Data.data);
    const stats2 = calculateAdvancedStats(stats2Data.data || [], player2Data.data);

    const comparisonData = {
      player1: player1Data.data,
      player2: player2Data.data,
      stats1,
      stats2,
      championComparison: calculateChampionComparison(stats1, stats2),
      overallComparison: calculateOverallComparison(stats1, stats2)
    };

    console.log(`✅ Comparaison terminée: ${player1} vs ${player2}`);
    res.json(comparisonData);

  } catch (err: any) {
    console.error("💥 Erreur route /players/compare:", err);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// 🔹 FONCTIONS UTILITAIRES POUR LA COMPARAISON
// =============================================================================

/**
 * Calcule les statistiques avancées d'un joueur
 */
const calculateAdvancedStats = (matches: any[], player: any) => {
  const stats = {
    total_games: matches.length,
    wins: 0,
    losses: 0,
    total_kills: 0,
    total_deaths: 0,
    total_assists: 0,
    total_cs: 0,
    champions: {} as Record<string, any>,
    roles: {} as Record<string, number>
  };

  matches.forEach(match => {
    const participant = match.data.info.participants.find((p: any) => 
      p.puuid === player.puuid
    );

    if (participant) {
      if (participant.win) stats.wins++;
      else stats.losses++;

      stats.total_kills += participant.kills;
      stats.total_deaths += participant.deaths;
      stats.total_assists += participant.assists;
      stats.total_cs += participant.totalMinionsKilled + participant.neutralMinionsKilled;

      // Stats par champion
      const champName = participant.championName;
      if (!stats.champions[champName]) {
        stats.champions[champName] = { wins: 0, losses: 0, games: 0, kills: 0, deaths: 0, assists: 0 };
      }
      stats.champions[champName].games++;
      if (participant.win) stats.champions[champName].wins++;
      else stats.champions[champName].losses++;
      stats.champions[champName].kills += participant.kills;
      stats.champions[champName].deaths += participant.deaths;
      stats.champions[champName].assists += participant.assists;

      // Stats par rôle
      const role = participant.teamPosition || 'UNKNOWN';
      stats.roles[role] = (stats.roles[role] || 0) + 1;
    }
  });

  // Calcul des moyennes
  return {
    ...stats,
    winrate: stats.total_games > 0 ? (stats.wins / stats.total_games) * 100 : 0,
    average_kda: stats.total_deaths > 0 ? 
      (stats.total_kills + stats.total_assists) / stats.total_deaths : 
      stats.total_kills + stats.total_assists,
    average_kills: stats.total_games > 0 ? stats.total_kills / stats.total_games : 0,
    average_deaths: stats.total_games > 0 ? stats.total_deaths / stats.total_games : 0,
    average_assists: stats.total_games > 0 ? stats.total_assists / stats.total_games : 0,
    average_cs: stats.total_games > 0 ? stats.total_cs / stats.total_games : 0
  };
};

/**
 * Calcule la comparaison des champions entre deux joueurs
 */
const calculateChampionComparison = (stats1, stats2) => {
  const champions = new Set([
    ...Object.keys(stats1.champions || {}),
    ...Object.keys(stats2.champions || {})
  ]);

  return Array.from(champions).map(champion => ({
    champion,
    player1: stats1.champions?.[champion] || null,
    player2: stats2.champions?.[champion] || null
  })).sort((a, b) => {
    const totalGamesA = (a.player1?.games || 0) + (a.player2?.games || 0);
    const totalGamesB = (b.player1?.games || 0) + (b.player2?.games || 0);
    return totalGamesB - totalGamesA;
  });
};

/**
 * Calcule la comparaison globale entre deux joueurs
 */
const calculateOverallComparison = (stats1, stats2) => {
  return {
    winrate: { player1: stats1.winrate, player2: stats2.winrate },
    kda: { player1: stats1.average_kda, player2: stats2.average_kda },
    kills: { player1: stats1.average_kills, player2: stats2.average_kills },
    deaths: { player1: stats1.average_deaths, player2: stats2.average_deaths },
    assists: { player1: stats1.average_assists, player2: stats2.average_assists },
    cs: { player1: stats1.average_cs, player2: stats2.average_cs }
  };
};

// =============================================================================
// ✅ ROUTE : Statistiques avancées des matchs
// =============================================================================
app.get("/player/:summonerName/stats", async (req, res) => {
  try {
    const { summonerName } = req.params;
    
    console.log(`📊 Calcul des stats pour: ${summonerName}`);

    // 1. Récupérer le joueur
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("puuid, summoner_name")
      .ilike("summoner_name", summonerName)
      .single();

    if (playerError || !player) {
      return res.status(404).json({ error: "Joueur non trouvé" });
    }

    // 2. Récupérer tous les matchs du joueur
    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("data")
      .eq("puuid", player.puuid);

    if (matchesError) {
      throw matchesError;
    }

    // 3. Calculer les statistiques
    const stats = calculateAdvancedStats(matches, player);

    // 4. Ajouter les informations supplémentaires
    const finalStats = {
      ...stats,
      favorite_champion: Object.entries(stats.champions)
        .sort((a, b) => b[1].games - a[1].games)[0]?.[0] || 'Aucun',
      favorite_role: Object.entries(stats.roles)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'UNKNOWN',
      best_champion: Object.entries(stats.champions)
        .filter(([_, data]) => data.games >= 3)
        .sort((a, b) => (b[1].wins / b[1].games) - (a[1].wins / a[1].games))[0]?.[0] || 'Aucun'
    };

    console.log(`✅ Stats calculées: ${finalStats.winrate.toFixed(1)}% winrate sur ${finalStats.total_games} games`);
    res.json(finalStats);

  } catch (err: any) {
    console.error("💥 Erreur route stats:", err);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// ✅ ROUTE : Route de test
// =============================================================================
app.get("/", (req, res) => {
  res.json({ 
    message: "✅ Backend League Tracker opérationnel !",
    version: "2.0.0",
    endpoints: [
      "GET  /players                          - Liste tous les joueurs",
      "GET  /player/:name                     - Détails d'un joueur", 
      "GET  /player/:name/matches             - Matchs RANKED SOLO d'un joueur",
      "GET  /player/:name/matches/update      - Met à jour les matchs",
      "GET  /player/:name/stats               - Statistiques avancées",
      "POST /update-player                    - Met à jour un joueur",
      "GET  /test-riot-api                    - Test la clé API Riot"
    ]
  });
});

// =============================================================================
// ✅ ROUTE DE TEST : Vérifier la clé API Riot
// =============================================================================
app.get("/test-riot-api", async (req, res) => {
  try {
    console.log("🧪 Test de la clé API Riot...");
    
    // Test simple sur l'API Account
    const testUrl = "https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/PANTHEKING/000";
    
    const response = await callRiotAPI(testUrl);

    console.log("📊 Status test API:", response.status);
    
    if (response.ok) {
      const data = await response.json();
      res.json({ 
        success: true, 
        message: "Clé API valide",
        player: data,
        rate_limits: {
          method: response.headers.get('x-method-rate-limit'),
          app: response.headers.get('x-app-rate-limit')
        }
      });
    } else {
      const errorText = await response.text();
      res.status(response.status).json({
        success: false,
        error: `Erreur ${response.status}`,
        details: errorText
      });
    }

  } catch (err: any) {
    console.error("💥 Erreur test API:", err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// =============================================================================
// 🔹 GESTION DES ERREURS GLOBALES
// =============================================================================

// Middleware pour les routes non trouvées
app.use((req, res) => {
  res.status(404).json({ 
    error: "Route non trouvée",
    path: req.path,
    method: req.method,
    available_endpoints: [
      "/players",
      "/player/:name", 
      "/player/:name/matches",
      "/player/:name/matches/update",
      "/player/:name/stats",
      "/update-player",
      "/test-riot-api"
    ]
  });
});

// Middleware global de gestion d'erreurs
app.use((error: any, req: any, res: any, next: any) => {
  console.error("💥 Erreur globale non gérée:", error);
  res.status(500).json({ 
    error: "Erreur interne du serveur",
    message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
  });
});

// =============================================================================
// 🔹 DÉMARRAGE DU SERVEUR
// =============================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Backend démarré sur http://localhost:${PORT}`);
  console.log(`🔑 Clé Riot API : ${RIOT_API_KEY ? "✅ PRÉSENTE" : "❌ ABSENTE"}`);
  console.log(`🏠 Supabase URL : ${process.env.SUPABASE_URL ? "✅ CONFIGURÉE" : "❌ NON CONFIGURÉE"}`);
  console.log(`🌍 Environnement : ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS configuré pour Netlify et Railway`);
  console.log(`\n📊 Endpoints disponibles:`);
  console.log(`   GET  /players                          - Liste tous les joueurs`);
  console.log(`   GET  /player/:name                     - Détails d'un joueur`);
  console.log(`   GET  /player/:name/matches             - Matchs RANKED SOLO d'un joueur`);
  console.log(`   GET  /player/:name/matches/update      - Met à jour les matchs`);
  console.log(`   GET  /player/:name/stats               - Statistiques avancées`);
  console.log(`   POST /update-player                    - Met à jour un joueur`);
  console.log(`   GET  /test-riot-api                    - Test la clé API Riot`);
  console.log(`\n🔧 Fonctionnalités améliorées:`);
  console.log(`   ✅ Gestion des rate limits Riot API`);
  console.log(`   ✅ Validation des paramètres d'entrée`);
  console.log(`   ✅ Traitement par batch des matchs`);
  console.log(`   ✅ Classes d'erreur personnalisées`);
  console.log(`   ✅ Sécurité et sanitization`);
  console.log(`   ✅ Gestion d'erreurs complète`);
  console.log(`   ✅ Filtre RANKED SOLO uniquement`);
  console.log(`   ✅ Configuration CORS pour Netlify + Railway`);
  console.log(`========================================================\n`);
});