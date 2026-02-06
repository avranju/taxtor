import { fetchAndParseForexCsv, type ForexRate } from './forex-rates';

const STORAGE_KEY = 'taxtor_forex_rates';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedData {
  rates: ForexRate[];
  timestamp: number;
}

let memoryCache: ForexRate[] | null = null;
let inflight: Promise<ForexRate[]> | null = null;

function loadFromStorage(): ForexRate[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached: CachedData = JSON.parse(raw);
    if (Date.now() - cached.timestamp > TTL_MS) return null;
    return cached.rates;
  } catch {
    return null;
  }
}

function saveToStorage(rates: ForexRate[]): void {
  try {
    const data: CachedData = { rates, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be full or unavailable; ignore
  }
}

/**
 * Get forex rates with caching and in-flight deduplication.
 * - Returns memory cache if available
 * - Deduplicates concurrent fetches
 * - Falls back to localStorage on network failure
 */
export async function getForexRates(): Promise<ForexRate[]> {
  if (memoryCache) return memoryCache;

  // Deduplicate: if a fetch is already in-flight, return the same promise
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const rates = await fetchAndParseForexCsv();
      memoryCache = rates;
      saveToStorage(rates);
      return rates;
    } catch (err) {
      // Fall back to localStorage cache (even if expired)
      const stored = loadFromStorage();
      if (stored) {
        memoryCache = stored;
        return stored;
      }
      // Try expired localStorage as last resort
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const cached: CachedData = JSON.parse(raw);
          memoryCache = cached.rates;
          return cached.rates;
        }
      } catch {
        // ignore
      }
      throw err;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
