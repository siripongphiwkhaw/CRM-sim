import { all, run } from "../client";
import type { SourceStatus } from "@/lib/constants";

export interface DataSource {
  id: number;
  name: string;
  source_type: string;
  direction: string;
  mode: string;
  status: SourceStatus;
  records_synced: number;
  last_synced_at: string | null;
  description: string | null;
  created_at: string;
}

export function listDataSources(): Promise<DataSource[]> {
  return all<DataSource>("SELECT * FROM data_sources ORDER BY name");
}

/** Marks a source as freshly synced (demo action for the Data Cloud module). */
export async function markSourceSynced(id: number): Promise<void> {
  await run(
    "UPDATE data_sources SET status = 'connected', last_synced_at = now() WHERE id = ?",
    [id]
  );
}

/** Re-syncs every source at once. */
export async function syncAllSources(): Promise<void> {
  await run(
    "UPDATE data_sources SET status = 'connected', last_synced_at = now()"
  );
}
