import { useState, useEffect, useCallback } from 'react';

const API = '/api';

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
}

export function useProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/properties`);
      const data = await res.json();
      setProperties(data);
    } catch { setProperties([]); }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { properties, loading, refresh, isEmpty: !loading && properties.length === 0 };
}
