import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button, inputClass, inputStyle } from "./ui";
import { relativeTime, initials } from "../lib/format";
import { Phone, Mail, Users as MeetingIcon, CheckSquare, StickyNote, Repeat, Monitor, FileText, MoreHorizontal } from "lucide-react";
import type { Activity, Note } from "../lib/types";

const activityIcons: Record<string, any> = {
  CALL: Phone, EMAIL: Mail, MEETING: MeetingIcon, TASK: CheckSquare, NOTE: StickyNote,
  FOLLOW_UP: Repeat, DEMO: Monitor, PROPOSAL: FileText, OTHER: MoreHorizontal,
};

type Assoc = { objectType: "ACCOUNT" | "CONTACT" | "OPPORTUNITY" | "DEAL"; accountId?: string; contactId?: string; opportunityId?: string; dealId?: string };

interface TimelineEvent {
  id: string;
  kind: "activity" | "note";
  at: string;
  activity?: Activity;
  note?: Note;
}

export function Timeline({ activities = [], notes = [], assoc, queryKeysToInvalidate }: {
  activities?: Activity[]; notes?: Note[]; assoc: Assoc; queryKeysToInvalidate: unknown[][];
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"log" | "note" | "task">("log");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<Activity["type"]>("CALL");

  const events: TimelineEvent[] = [
    ...activities.map((a) => ({ id: a.id, kind: "activity" as const, at: a.createdAt, activity: a })),
    ...notes.map((n) => ({ id: n.id, kind: "note" as const, at: n.createdAt, note: n })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const invalidate = () => queryKeysToInvalidate.forEach((k) => qc.invalidateQueries({ queryKey: k }));

  const logActivity = useMutation({
    mutationFn: () => api.post("/activities", { type, subject, body: body || null, status: "COMPLETED", ...assoc, objectType: assoc.objectType }),
    onSuccess: () => { setSubject(""); setBody(""); invalidate(); },
  });
  const logTask = useMutation({
    mutationFn: () => api.post("/activities", { type: "TASK", subject, status: "PENDING", ...assoc, objectType: assoc.objectType }),
    onSuccess: () => { setSubject(""); invalidate(); },
  });
  const addNote = useMutation({
    mutationFn: () => api.post("/notes", { body, ...assoc }),
    onSuccess: () => { setBody(""); invalidate(); },
  });

  return (
    <div>
      <div className="flex gap-1 mb-3 border-b" style={{ borderColor: "var(--ink-100)" }}>
        {(["log", "note", "task"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-2 text-xs font-medium border-b-2 -mb-px"
            style={{ borderColor: tab === t ? "var(--ledger-600)" : "transparent", color: tab === t ? "var(--ledger-700)" : "var(--ink-400)" }}
          >
            {t === "log" ? "Log activity" : t === "note" ? "Add note" : "Create task"}
          </button>
        ))}
      </div>

      {tab === "log" && (
        <div className="mb-5 p-3 rounded-lg" style={{ background: "var(--ink-50)" }}>
          <select value={type} onChange={(e) => setType(e.target.value as Activity["type"])} className={`${inputClass} mb-2 bg-white`} style={inputStyle}>
            {["CALL", "EMAIL", "MEETING", "DEMO", "PROPOSAL", "FOLLOW_UP", "OTHER"].map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={`${inputClass} mb-2 bg-white`} style={inputStyle} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details (optional)" rows={2} className={`${inputClass} mb-2 bg-white`} style={inputStyle} />
          <Button size="sm" disabled={!subject || logActivity.isPending} onClick={() => logActivity.mutate()}>Log</Button>
        </div>
      )}
      {tab === "note" && (
        <div className="mb-5 p-3 rounded-lg" style={{ background: "var(--ink-50)" }}>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a note…" rows={3} className={`${inputClass} mb-2 bg-white`} style={inputStyle} />
          <Button size="sm" disabled={!body || addNote.isPending} onClick={() => addNote.mutate()}>Save note</Button>
        </div>
      )}
      {tab === "task" && (
        <div className="mb-5 p-3 rounded-lg" style={{ background: "var(--ink-50)" }}>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Task…" className={`${inputClass} mb-2 bg-white`} style={inputStyle} />
          <Button size="sm" disabled={!subject || logTask.isPending} onClick={() => logTask.mutate()}>Create task</Button>
        </div>
      )}

      {events.length === 0 ? (
        <div className="text-sm py-6 text-center" style={{ color: "var(--ink-400)" }}>No activity yet.</div>
      ) : (
        <div className="space-y-4">
          {events.map((ev) => {
            if (ev.kind === "activity" && ev.activity) {
              const Icon = activityIcons[ev.activity.type] || MoreHorizontal;
              return (
                <div key={ev.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--ledger-100)" }}>
                    <Icon size={13} style={{ color: "var(--ledger-700)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-medium">{ev.activity.subject}</span>
                      {ev.activity.status === "PENDING" && <span className="ml-2 text-xs" style={{ color: "var(--amber-600)" }}>Pending</span>}
                    </div>
                    {ev.activity.body && <div className="text-sm mt-0.5" style={{ color: "var(--ink-600)" }}>{ev.activity.body}</div>}
                    <div className="text-xs mt-0.5" style={{ color: "var(--ink-400)" }}>{relativeTime(ev.at)}</div>
                  </div>
                </div>
              );
            }
            if (ev.kind === "note" && ev.note) {
              return (
                <div key={ev.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold text-white" style={{ background: "var(--ink-600)" }}>
                    {initials(ev.note.author?.firstName, ev.note.author?.lastName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm rounded-lg px-3 py-2" style={{ background: "var(--ink-50)" }}>{ev.note.body}</div>
                    <div className="text-xs mt-1" style={{ color: "var(--ink-400)" }}>{relativeTime(ev.at)}</div>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}
