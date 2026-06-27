/**
 * Sync engine — replays queued mutations to Supabase when back online.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clearQueue,
  dequeueMutation,
  getQueuedMutations,
  type QueuedMutation,
} from "./db";

/**
 * Replay all queued mutations to Supabase.
 * Returns the number of mutations successfully synced.
 * Stops on first error so we don't skip mutations.
 */
export async function syncQueue(supabase: SupabaseClient): Promise<{
  synced: number;
  failed: number;
}> {
  const mutations = await getQueuedMutations();
  if (mutations.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const mutation of mutations) {
    const ok = await replayMutation(supabase, mutation);
    if (ok) {
      if (mutation.id) await dequeueMutation(mutation.id);
      synced++;
    } else {
      failed++;
      break; // stop on first failure — retry later
    }
  }

  return { synced, failed };
}

async function replayMutation(
  supabase: SupabaseClient,
  mutation: QueuedMutation,
): Promise<boolean> {
  try {
    if (mutation.operation === "update" && mutation.recordId) {
      const { error } = await supabase
        .from(mutation.table)
        .update(mutation.payload)
        .eq("id", mutation.recordId);
      return !error;
    }

    if (mutation.operation === "insert") {
      const { error } = await supabase
        .from(mutation.table)
        .insert(mutation.payload);
      return !error;
    }

    return false;
  } catch {
    return false;
  }
}
