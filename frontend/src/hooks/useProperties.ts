import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/api';

export interface Property {
  id: number;
  name: string;
  address: string;
  ical_airbnb?: string;
  ical_booking?: string;
  checkout_time: string;
  checkin_time: string;
  cleaning_mins: number;
  rate: number;
  sunday_rate: number;
  color: string;
  enabled: number;
  purchase_price?: number;
  travaux?: number;
  monthly_charges?: number;
  monthly_revenue?: number;
  credit_mensuel?: number;
}

export function useProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/properties`);
      const data = await res.json();
      setProperties(Array.isArray(data) ? data : []);
    } catch { setProperties([]); }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const deleteProperty = useCallback(async (id: number) => {
    await apiFetch(`/properties/${id}`, { method: 'DELETE' });
    await refresh();
  }, [refresh]);

  const updateProperty = useCallback(async (id: number, data: Partial<Property>) => {
    const res = await apiFetch(`/properties/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    await refresh();
    return updated;
  }, [refresh]);

  const toggleEnabled = useCallback(async (id: number, enabled: boolean) => {
    await apiFetch(`/properties/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    await refresh();
  }, [refresh]);

  return { properties, loading, refresh, isEmpty: !loading && properties.length === 0, deleteProperty, updateProperty, toggleEnabled };
}
