/**
 * Oracle Sentinel - Temporal Worker that executes interview workflows and activities
 */

import 'dotenv/config';
import { Worker, NativeConnection } from '@temporalio/worker';
import { loggers } from 'the-machina';
import { getTemporalConfig } from './temporal/config';
import * as activities from './activities';

async function run() {
  const config = getTemporalConfig();

  try {
    const connection = await NativeConnection.connect({
      address: config.address
    });

    const worker = await Worker.create({
      connection,
      namespace: config.namespace,
      taskQueue: 'oracle-queue',
      workflowsPath: require.resolve('./workflows/interview-workflow'),
      activities
    });

    loggers.temporal.info('Oracle Sentinel started', { taskQueue: 'oracle-queue' });

    // Graceful shutdown
    const shutdownHandler = async () => {
      loggers.temporal.info('Shutting down Oracle Sentinel...');
      worker.shutdown();
    };

    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);

    await worker.run();
  } catch (error) {
    loggers.temporal.error('Oracle Sentinel failed', error as Error);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
