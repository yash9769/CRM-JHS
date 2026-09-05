import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { StickyNote as StickyIcon, Plus, X, Minus, Maximize2, Palette, Check, Pin, PinOff } from "lucide-react";
import { api } from "../lib/api";

export interface StickyNoteItem {
  id: string;
  title: string | null;
  content: string;
  color: string | null;
  isPinned: boolean;
  isMinimized: boolean;
  positionX: number;
  positionY: number;
  updatedAt: string;
}

const NOTE_COLORS: { name: string; bg: string; border: string; header: string; text: string }[] = [
  { name: "yellow", bg: "bg-amber-50", border: "border-amber-200", header: "bg-amber-100/70", text: "text-amber-950" },
  { name: "blue", bg: "bg-sky-50", border: "border-sky-200", header: "bg-sky-100/70", text: "text-sky-950" },
  { name: "green", bg: "bg-emerald-50", border: "border-emerald-200", header: "bg-emerald-100/70", text: "text-emerald-950" },
  { name: "pink", bg: "bg-pink-50", border: "border-pink-200", header: "bg-pink-100/70", text: "text-pink-950" },
  { name: "purple", bg: "bg-purple-50", border: "border-purple-200", header: "bg-purple-100/70", text: "text-purple-950" },
];

function getColorConfig(colorName: string | null) {
  return NOTE_COLORS.find((c) => c.name === colorName) || NOTE_COLORS[0];
}

export function StickyNotesWidget() {
  const location = useLocation();
  const isDashboard = location.pathname === "/";

  const [notes, setNotes] = useState<StickyNoteItem[]>([]);
  const [globalPinned, setGlobalPinned] = useState(() => {
    return localStorage.getItem("crm_sticky_notes_all_pages") === "true";
  });
  const [isWidgetOpen, setIsWidgetOpen] = useState(true);

  // Fetch notes on mount
  useEffect(() => {
    async function loadNotes() {
      try {
        const res = await api.get("/sticky-notes");
        setNotes(res.data.data || []);
      } catch (err) {
        console.error("Failed to load sticky notes", err);
      }
    }
    loadNotes();
  }, []);

  // Update global pinned state in localStorage and server
  const toggleGlobalPinned = async () => {
    const nextVal = !globalPinned;
    setGlobalPinned(nextVal);
    localStorage.setItem("crm_sticky_notes_all_pages", nextVal ? "true" : "false");
  };

  const handleCreateNote = async () => {
    try {
      const res = await api.post("/sticky-notes", {
        title: `Note #${notes.length + 1}`,
        content: "",
        color: NOTE_COLORS[notes.length % NOTE_COLORS.length].name,
        isPinned: globalPinned,
        isMinimized: false,
      });
      setNotes((prev) => [res.data.data, ...prev]);
    } catch (err) {
      console.error("Failed to create note", err);
    }
  };

  const handleUpdateNote = async (id: string, updates: Partial<StickyNoteItem>) => {
    // Optimistic update
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
    try {
      await api.patch(`/sticky-notes/${id}`, updates);
    } catch (err) {
      console.error("Failed to update note", err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.delete(`/sticky-notes/${id}`);
    } catch (err) {
      console.error("Failed to delete note", err);
    }
  };

  // If not dashboard and not pinned globally, don't render on other pages
  if (!isDashboard && !globalPinned) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 pointer-events-none">
      {/* Active Sticky Notes Container */}
      {isWidgetOpen && (
        <div className="flex flex-wrap-reverse gap-3 items-end justify-end max-w-[calc(100vw-2rem)] md:max-w-4xl max-h-[80vh] overflow-y-auto p-1 pointer-events-auto">
          {notes.map((note) => (
            <SingleNoteCard
              key={note.id}
              note={note}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
            />
          ))}
        </div>
      )}

      {/* Floating Control Bar */}
      <div className="flex items-center gap-2 bg-[var(--surface-raised)]/95 backdrop-blur border border-[var(--ink-200)] shadow-lg rounded-full px-3 py-1.5 pointer-events-auto transition-all">
        <button
          onClick={handleCreateNote}
          className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ledger-700)] hover:text-[var(--ledger-900)] bg-[var(--ledger-50)] hover:bg-[var(--ledger-100)] px-2.5 py-1 rounded-full transition-colors"
          title="Add New Sticky Note"
        >
          <Plus size={14} />
          <span>New Note</span>
        </button>

        <div className="h-4 w-[1px] bg-[var(--ink-200)]" />

        {/* Keep on all pages toggle */}
        <button
          onClick={toggleGlobalPinned}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
            globalPinned
              ? "bg-[var(--ledger-600)] text-white font-medium"
              : "text-[var(--ink-600)] hover:bg-[var(--ink-100)]"
          }`}
          title={globalPinned ? "Notes stay visible on all pages (Click to disable)" : "Keep notes visible on all pages"}
        >
          {globalPinned ? <Pin size={12} className="fill-white" /> : <PinOff size={12} />}
          <span className="hidden sm:inline">{globalPinned ? "All Pages ON" : "Keep on all pages"}</span>
        </button>

        <button
          onClick={() => setIsWidgetOpen((v) => !v)}
          className="p-1 rounded-full text-[var(--ink-500)] hover:bg-[var(--ink-100)]"
          title={isWidgetOpen ? "Hide Notes" : "Show Notes"}
        >
          <StickyIcon size={16} className={isWidgetOpen ? "text-[var(--ledger-600)]" : ""} />
        </button>
      </div>
    </div>
  );
}

function SingleNoteCard({
  note,
  onUpdate,
  onDelete,
}: {
  note: StickyNoteItem;
  onUpdate: (id: string, updates: Partial<StickyNoteItem>) => void;
  onDelete: (id: string) => void;
}) {
  const colorCfg = getColorConfig(note.color);
  const [title, setTitle] = useState(note.title || "");
  const [content, setContent] = useState(note.content || "");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const debounceTimer = useRef<any>(null);

  useEffect(() => {
    setTitle(note.title || "");
    setContent(note.content || "");
  }, [note.title, note.content]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      onUpdate(note.id, { title: val });
    }, 600);
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      onUpdate(note.id, { content: val });
    }, 600);
  };

  if (note.isMinimized) {
    return (
      <div
        className={`w-48 shadow-md rounded-lg border ${colorCfg.border} ${colorCfg.bg} ${colorCfg.text} overflow-hidden transition-all flex items-center justify-between px-3 py-1.5`}
      >
        <span className="text-xs font-semibold truncate flex-1">{title || "Untitled Note"}</span>
        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={() => onUpdate(note.id, { isMinimized: false })}
            className="p-1 hover:bg-black/10 rounded"
            title="Expand Note"
          >
            <Maximize2 size={12} />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1 hover:bg-black/10 rounded"
            title="Delete Note"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-64 sm:w-72 shadow-xl rounded-xl border ${colorCfg.border} ${colorCfg.bg} ${colorCfg.text} flex flex-col overflow-hidden transition-all duration-150 animate-in fade-in zoom-in-95`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-1.5 border-b ${colorCfg.border} ${colorCfg.header}`}>
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note title..."
          className="bg-transparent border-none text-xs font-semibold outline-none w-full mr-2 placeholder:text-black/30"
        />
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <button
              onClick={() => setShowColorPicker((v) => !v)}
              className="p-1 hover:bg-black/10 rounded text-black/60"
              title="Change Color"
            >
              <Palette size={13} />
            </button>
            {showColorPicker && (
              <div className="absolute right-0 top-6 bg-[var(--surface-raised)] border border-gray-200 shadow-xl rounded-lg p-1.5 flex gap-1 z-50">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => {
                      onUpdate(note.id, { color: c.name });
                      setShowColorPicker(false);
                    }}
                    className={`w-5 h-5 rounded-full ${c.bg} border ${c.border} flex items-center justify-center`}
                  >
                    {note.color === c.name && <Check size={10} className="text-black/70" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => onUpdate(note.id, { isMinimized: true })}
            className="p-1 hover:bg-black/10 rounded text-black/60"
            title="Minimize Note"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1 hover:bg-black/10 rounded text-black/60 hover:text-red-600"
            title="Delete Note"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-2.5">
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Write your quick notes, tasks, or reminders here..."
          rows={5}
          className="w-full bg-transparent border-none outline-none resize-none text-xs leading-relaxed placeholder:text-black/30 font-sans"
        />
      </div>
    </div>
  );
}
