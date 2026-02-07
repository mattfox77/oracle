/**
 * Temporal Client for Oracle
 */

import { Client, Connection } from '@temporalio/client';
import { getTemporalConfig } from './config';

let clientPromise: Promise<Client> | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const config = getTemporalConfig();
      const connection = await Connection.connect({
        address: config.address
      });
      return new Client({
        connection,
        namespace: config.namespace
      });
    })();
  }
  return clientPromise;
}
