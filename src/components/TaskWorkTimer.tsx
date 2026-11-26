import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export type TaskTimerState = {
  id: string;
  assignee_id: string | null;
  actual_seconds?: number | undefined;
  timer_started_at?: string | null | undefined;
  timer_started_by?: string | null | undefined;
};

export function TaskWorkTimer({
  task,
  memberId,
  onToggle,
  compact = false,
}: {
  task: TaskTimerState;
  memberId: string;
  onToggle: (id: string, action: "start" | "stop") => void;
  compact?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!task.timer_started_at) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [task.timer_started_at]);
  const ownTimer = task.timer_started_by === memberId;
  const seconds = (task.actual_seconds ?? 0) + (task.timer_started_at ? Math.max(0, Math.floor((now - new Date(task.timer_started_at).getTime()) / 1000)) : 0);
  const display = `${Math.floor(seconds / 3600).toString().padStart(2,"0")}:${Math.floor((seconds % 3600) / 60).toString().padStart(2,"0")}:${(seconds % 60).toString().padStart(2,"0")}`;
  if (compact) return (
    <div className="flex items-center gap-1.5" aria-label="Task work timer">
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground" aria-live="off">{display}</span>
      {task.assignee_id === memberId && <Button size="sm" variant={ownTimer ? "outline" : "default"} className="h-7 px-2 text-[10px]" disabled={!!task.timer_started_at && !ownTimer} onClick={() => onToggle(task.id, ownTimer ? "stop" : "start")}>{ownTimer ? "Stop" : "Start"}</Button>}
    </div>
  );
  return <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3" aria-label="Task work timer"><div><p className="text-xs text-muted-foreground">Actual time logged</p><p className="font-mono text-lg font-semibold tabular-nums">{display}</p>{task.timer_started_at && <p className="text-[10px] text-muted-foreground">{ownTimer ? "Your timer is running" : "Timer is running for the assigned member"}</p>}</div>{task.assignee_id === memberId && <Button size="sm" variant={ownTimer ? "outline" : "default"} disabled={!!task.timer_started_at && !ownTimer} onClick={() => onToggle(task.id, ownTimer ? "stop" : "start")}>{ownTimer ? "Stop & save time" : "Start timer"}</Button>}</section>;
}
