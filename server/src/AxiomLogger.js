import { Axiom } from '@axiomhq/js';

const client = process.env.AXIOM_TOKEN
  ? new Axiom({ token: process.env.AXIOM_TOKEN })
  : null;

const DATASET = process.env.AXIOM_DATASET ?? 'agent-mmorpg';

if (!client) {
  console.warn('[AxiomLogger] AXIOM_TOKEN not set — logging disabled');
} else {
  // Flush buffered events every 10 seconds
  setInterval(() => client.flush().catch(() => {}), 10000);
  console.log(`[AxiomLogger] logging to dataset "${DATASET}"`);
}

export function logAction(agentId, action, meta = {}) {
  if (!client) return;
  // ingest() batches internally; flush() sends — errors handled in flush()
  client.ingest(DATASET, [{
    _time: new Date().toISOString(),
    agentId,
    action,
    ...meta,
  }]);
}

export function flush() {
  return client?.flush() ?? Promise.resolve();
}
