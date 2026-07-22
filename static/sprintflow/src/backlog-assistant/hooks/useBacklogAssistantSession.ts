import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@forge/bridge';
import { useBacklogAssistantStore } from '../stores/backlogAssistantStore';
import type { SessionData } from '../types';

// invoke() from @forge/bridge returns InvokeResponse<T> — cast through unknown to get T
async function call<T>(fn: string, payload?: Record<string, unknown>): Promise<T> {
  return invoke(fn, payload) as unknown as Promise<T>;
}

function buildSessionData(): SessionData {
  const store = useBacklogAssistantStore.getState();
  const rawPositions = store.graphApi?.getPositions() || {};
  const nodePositions: Record<string, { x: number; y: number }> = {};
  for (const [id, pos] of Object.entries(rawPositions)) {
    if (store.issues[id]) nodePositions[id] = { x: Math.round(pos.x), y: Math.round(pos.y) };
  }
  return {
    nodePositions,
    collapsedObjectives: [...store.collapsedObjectives],
    rankOverrides: store.rankOverrides,
  };
}

function formatSavedLabel(): string {
  return `Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// `ready` gates the debounced autosave until the initial live-data load has finished, so a
// (still-empty) store doesn't overwrite the just-loaded session before hydration completes.
// `knownIssueKeys` is bookkeeping owned by useBacklogAssistantData — passed through unchanged
// on every save so this hook's periodic writes never clobber it.
export function useBacklogAssistantSession(projectKey: string, knownIssueKeys: string[], ready: boolean) {
  const [autosaveLabel, setAutosaveLabel] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectKeyRef = useRef(projectKey);
  projectKeyRef.current = projectKey;
  const knownIssueKeysRef = useRef(knownIssueKeys);
  knownIssueKeysRef.current = knownIssueKeys;

  const autosaveTick = useBacklogAssistantStore((s) => s.autosaveTick);

  const flushSave = useRef(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const session = buildSessionData();
    call('saveBacklogAssistantSession', {
      projectKey: projectKeyRef.current,
      session: { ...session, knownIssueKeys: knownIssueKeysRef.current },
    })
      .then(() => setAutosaveLabel(formatSavedLabel()))
      .catch((err) => console.error('Backlog Assistant: failed to save session', err));
  }).current;

  useEffect(() => {
    if (!ready) return undefined;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushSave, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [autosaveTick, ready, flushSave]);

  useEffect(() => {
    return () => {
      flushSave();
    };
  }, [flushSave]);

  const exportWork = useCallback(() => {
    const data = buildSessionData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backlog-plan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const importFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(String(e.target?.result || '')) as SessionData;
        if (!data.nodePositions || !data.rankOverrides) {
          throw new Error('Not a valid Backlog Assistant save file.');
        }
        const store = useBacklogAssistantStore.getState();
        store.applySessionData(data);
        store.graphApi?.applySessionPositions(data.nodePositions || {});
        store.graphApi?.fit();
        setAutosaveLabel(formatSavedLabel());
      } catch (err) {
        window.alert(`Could not load save file: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
  }, []);

  return { autosaveLabel, exportWork, importFile };
}
