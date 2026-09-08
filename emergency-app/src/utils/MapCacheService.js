// src/utils/MapCacheService.js
const CACHE_NAME = 'phantom-map-v1';

// 1. Used for standard files (like PDF medical guides or external URLs)
export async function cacheMapData(url) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(url);
    if (response.ok) {
      await cache.put(url, response.clone());
      console.log("✅ Risk Pack: Downloaded and cached offline.");
      return true;
    }
  } catch (error) {
    console.error("Caching failed:", error);
    return false;
  }
}

// 2. NEW: Used specifically to save our AI-generated JSON directly into cache
export async function cacheRawMapData(cacheKey, jsonData) {
  try {
    const cache = await caches.open(CACHE_NAME);
    // Create a "fake" HTTP response so the Cache API accepts it
    const syntheticResponse = new Response(JSON.stringify(jsonData), {
      headers: { 'Content-Type': 'application/json' }
    });
    
    // Save it under a custom string key instead of a real URL
    await cache.put(cacheKey, syntheticResponse);
    console.log(`✅ AI Generated Map securely cached offline as: ${cacheKey}`);
    return true;
  } catch (error) {
    console.error("Failed to cache raw AI map data:", error);
    return false;
  }
}

// 3. Retrieves either a standard URL or a custom cacheKey
export async function getCachedMap(identifier) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(identifier);
    if (cachedResponse) {
      return await cachedResponse.json();
    }
    return null;
  } catch (error) {
    console.error("Failed to retrieve from cache:", error);
    return null;
  }
}