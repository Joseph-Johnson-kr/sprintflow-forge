import { useEffect, useState } from 'react';
import { view } from '@forge/bridge';
import App from './App';
import EpicPlanningApp from './epic-planning/EpicPlanningApp';
import BacklogAssistantApp from './backlog-assistant/BacklogAssistantApp';

export default function Root() {
  const [action, setAction] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    view
      .getContext()
      .then((ctx) => {
        if (cancelled) return;
        setAction(ctx.extension?.action ?? null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;
  return action === 'epic-planning' ? (
    <EpicPlanningApp />
  ) : action === 'backlog-assistant' ? (
    <BacklogAssistantApp />
  ) : (
    <App />
  );
}
