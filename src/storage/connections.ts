import { HermesConnection } from '../api/hermes/types';
import { kvGet, kvSet } from './kv';

const CONNECTIONS_KEY = 'ihermes.connections.v1';

export async function loadConnections(): Promise<HermesConnection[]> {
  const raw = await kvGet(CONNECTIONS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as HermesConnection[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveConnections(connections: HermesConnection[]): Promise<void> {
  await kvSet(CONNECTIONS_KEY, JSON.stringify(connections));
}
