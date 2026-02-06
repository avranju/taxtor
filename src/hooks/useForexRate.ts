import { useState, useEffect, useRef } from 'react';
import { getForexRates } from '../lib/forex-cache';
import { lookupRate } from '../lib/forex-rates';

interface UseForexRateResult {
  rate: number | null;
  rateDate: string | null;
  isExactDate: boolean;
  loading: boolean;
  error: string | null;
}

export function useForexRate(date: string | undefined): UseForexRateResult {
  const [result, setResult] = useState<UseForexRateResult>({
    rate: null,
    rateDate: null,
    isExactDate: false,
    loading: false,
    error: null,
  });

  const latestDateRef = useRef(date);
  latestDateRef.current = date;

  useEffect(() => {
    if (!date) {
      setResult({ rate: null, rateDate: null, isExactDate: false, loading: false, error: null });
      return;
    }

    let cancelled = false;

    setResult(prev => ({ ...prev, loading: true, error: null }));

    getForexRates()
      .then(rates => {
        if (cancelled || latestDateRef.current !== date) return;

        const lookup = lookupRate(rates, date);
        if (!lookup) {
          setResult({
            rate: null,
            rateDate: null,
            isExactDate: false,
            loading: false,
            error: 'No exchange rate available for this date (before Jan 2020)',
          });
          return;
        }

        setResult({
          rate: lookup.rate,
          rateDate: lookup.date,
          isExactDate: lookup.isExactDate,
          loading: false,
          error: null,
        });
      })
      .catch(err => {
        if (cancelled || latestDateRef.current !== date) return;
        setResult({
          rate: null,
          rateDate: null,
          isExactDate: false,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load exchange rates',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [date]);

  return result;
}
