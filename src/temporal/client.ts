/**
 * Temporal Client for Oracle
 */

import { Client, Connection } from '@temporalio/client';
import { loggers } from 'the-machina';
import { getTemporalConfig } from './config';

let clientPromise: Promise<Client> | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (!clientPromise) {
    const pending = (async () => {
      const config = getTemporalConfig();
      loggers.temporal.info('Connecting to Temporal', { address: config.address, namespace: config.namespace });
      const connection = await Connection.connect({
        address: config.address
      });
      const client = new Client({
        connection,
        namespace: config.namespace
      });
      loggers.temporal.info('Temporal client connected', { address: config.address });
      return client;
    })();

    clientPromise = pending;

    // Clear the cached promise on failure so subsequent calls can retry
    pending.catch((error) => {
      loggers.temporal.error('Temporal connection failed', { error: (error as Error).message });
      if (clientPromise === pending) {
        clientPromise = null;
      }
    });
  }
  return clientPromise;
}
