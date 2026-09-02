import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button, inputClass, inputStyle } from "./ui";
import { relativeTime, initials } from "../lib/format";
import { FileText, Send, Trash2 } from "lucide-react";
import type { Note } from "../lib/types";

export function NotesOnlyPanel({
  notes = [],
  assoc,
  queryKeysToInvalidate,
}: {
  notes?: Note[];
  assoc: { objectType: "OPPORTUNITY" | "ACCOUNT" | "CONTACT" | "LEAD"; opportunityId?: string; accountId?: string; contactId?: string; leadId?: string };
  queryKeysToInvalidate: unknown[][];
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const invalidate = () => queryKeysToInvalidate.forEach((k) => qc.invalidateQueries({ queryKey: k }));

  const addNote = useMutation({
    mutationFn: () => api.post("/notes", { body: body.trim(), ...assoc }),
    onSuccess: () => {
      setBody("");
      invalidate();
    },
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: string) => api.delete(`/notes/${noteId}`),
    onSuccess: () => {
      invalidate();
    },
  });

  return (
    <div className="space-y-4">
      {/* Note Creation Form */}
      <div className="p-3.5 rounded-xl bg-[var(--ink-50)] border border-[var(--ink-100)] space-y-2.5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add an internal note or update on this opportunity…"
          rows={3}
          className={`${inputClass} bg-white text-xs leading-relaxed resize-none`}
          style={inputStyle}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!body.trim() || addNote.isPending}
            onClick={() => addNote.mutate()}
          >
            <Send size={12} /> Add Note
          </Button>
        </div>
      </div>

      {/* Notes List */}
      {!notes.length ? (
        <div className="text-xs text-[var(--ink-400)] py-8 text-center flex flex-col items-center gap-1.5">
          <FileText size={24} className="text-[var(--ink-300)]" />
          <span>No notes added yet</span>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-3 rounded-xl border border-[var(--ink-100)] bg-white space-y-2 hover:border-[var(--ink-200)] transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[var(--ledger-100)] text-[var(--ledger-800)] text-[10px] font-bold flex items-center justify-center shrink-0">
                    {initials(note.author?.firstName, note.author?.lastName)}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[var(--ink-900)]">
                      {note.author ? `${note.author.firstName} ${note.author.lastName}` : "User"}
                    </div>
                    <div className="text-[10px] text-[var(--ink-400)]">
                      {relativeTime(note.createdAt)}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => deleteNote.mutate(note.id)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--ink-400)] hover:text-red-600 p-1 transition-opacity"
                  title="Delete note"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div className="text-xs text-[var(--ink-800)] whitespace-pre-wrap leading-relaxed">
                {note.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
