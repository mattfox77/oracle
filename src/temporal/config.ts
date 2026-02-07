/**
 * Temporal Configuration for Oracle
 */

export interface TemporalConfig {
  address: string;
  namespace: string;
}

export function getTemporalConfig(): TemporalConfig {
  return {
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    namespace: process.env.TEMPORAL_NAMESPACE || 'default'
  };
}
