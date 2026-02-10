import { useEffect, useState } from 'react';
import { api } from '../api/mcpClient';
import { useAuth } from '../contexts/AuthContext';
import { normalizeConfig } from '../utils/tableConfig';
import type { ColumnConfig } from '../utils/tableConfig';

export function useTableConfig(tableKey: string, defaults: ColumnConfig[]) {
  const { accessToken } = useAuth();
  const [configs, setConfigs] = useState<ColumnConfig[]>(
    normalizeConfig([], defaults),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!accessToken) {
        setConfigs(normalizeConfig([], defaults));
        return;
      }
      try {
        setLoading(true);
        const result = (await api.tableConfigGet(accessToken, tableKey)) as {
          items: ColumnConfig[];
        };
        const normalized = normalizeConfig(result.items || [], defaults);
        if (!cancelled) setConfigs(normalized);
      } catch {
        if (!cancelled) setConfigs(normalizeConfig([], defaults));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, tableKey, defaults]);

  return { configs, loading };
}
