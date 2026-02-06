const CSV_URL =
  'https://raw.githubusercontent.com/sahilgupta/sbi-fx-ratekeeper/main/csv_files/SBI_REFERENCE_RATES_USD.csv';

export interface ForexRate {
  date: string; // YYYY-MM-DD
  ttBuyRate: number;
}

export interface ForexRateLookupResult {
  rate: number;
  date: string; // actual date the rate is from
  isExactDate: boolean;
}

/**
 * Fetch and parse the SBI FX RateKeeper CSV for USD TT Buy rates.
 * CSV columns: DATE, PDF FILE, TT BUY, TT SELL, BILL BUY, BILL SELL, ...
 */
export async function fetchAndParseForexCsv(): Promise<ForexRate[]> {
  const response = await fetch(CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch forex rates: ${response.status}`);
  }

  const text = await response.text();
  const lines = text.split('\n');
  const rates: ForexRate[] = [];

  // Skip header line (index 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',');
    if (cols.length < 3) continue;

    // Column 0: "YYYY-MM-DD HH:MM" — extract date part
    const datePart = cols[0].trim().split(' ')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) continue;

    // Column 2: TT BUY rate
    const rate = parseFloat(cols[2].trim());
    if (isNaN(rate) || rate === 0) continue;

    rates.push({ date: datePart, ttBuyRate: rate });
  }

  // Sort ascending by date
  rates.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return rates;
}

/**
 * Binary search for a rate on or before the target date.
 * Returns null if the target date is before the dataset start.
 */
export function lookupRate(
  rates: ForexRate[],
  targetDate: string
): ForexRateLookupResult | null {
  if (rates.length === 0) return null;

  // If target is before the earliest date in the dataset
  if (targetDate < rates[0].date) return null;

  // Binary search for the exact date or nearest previous
  let lo = 0;
  let hi = rates.length - 1;
  let bestIdx = 0;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (rates[mid].date === targetDate) {
      return {
        rate: rates[mid].ttBuyRate,
        date: rates[mid].date,
        isExactDate: true,
      };
    } else if (rates[mid].date < targetDate) {
      bestIdx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return {
    rate: rates[bestIdx].ttBuyRate,
    date: rates[bestIdx].date,
    isExactDate: false,
  };
}
