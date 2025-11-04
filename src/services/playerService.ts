export async function updatePlayer(summonerName: string, region: string, tagLine?: string) {
  try {
    const cleanName = summonerName.split("#")[0].trim();
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

    const response = await fetch(`${backendUrl}/update-player`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        summonerName: cleanName, 
        region: region.toLowerCase(),
        tagLine: tagLine
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();
    return data;
    
  } catch (err: any) {
    if (err.message.includes("Failed to fetch")) {
      throw new Error("Serveur inaccessible - vérifiez que le backend est démarré");
    }
    throw err;
  }
}