import { useState } from "react";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "../lib/format";
import { Badge } from "./ui";

interface KanbanItem {
  id: string;
  name: string;
  amount: string;
  stageId: string;
  closeDate?: string | null;
  expectedCloseDate?: string | null;
  probability: number;
  account?: { name: string } | null;
  owner?: { firstName: string; lastName: string } | null;
}

export function KanbanBoard<T extends KanbanItem>({
  stages, items, basePath, onMove,
}: {
  stages: { id: string; name: string; isClosed: boolean; isWon: boolean }[];
  items: T[];
  basePath: string;
  onMove: (item: T, newStageId: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageItems = items.filter((i) => i.stageId === stage.id);
        const total = stageItems.reduce((s, i) => s + Number(i.amount), 0);
        return (
          <div
            key={stage.id}
            className="w-72 shrink-0 rounded-xl"
            style={{ background: "var(--ink-50)" }}
            onDragOver={(e) => { e.preventDefault(); setOverStage(stage.id); }}
            onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setOverStage(null);
              const item = items.find((i) => i.id === dragId);
              if (item && item.stageId !== stage.id) onMove(item, stage.id);
              setDragId(null);
            }}
          >
            <div className="px-3.5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-600)" }}>{stage.name}</span>
                <span className="text-xs font-mono-num" style={{ color: "var(--ink-400)" }}>{stageItems.length}</span>
              </div>
            </div>
            <div className="px-3.5 pb-1 text-xs font-mono-num" style={{ color: "var(--ink-400)" }}>{formatCurrency(total)}</div>
            <div
              className="px-2.5 pb-3 space-y-2 min-h-[80px] rounded-b-xl transition-colors"
              style={{ background: overStage === stage.id ? "var(--ledger-50)" : "transparent" }}
            >
              {stageItems.map((item) => (
                <Link
                  key={item.id}
                  to={`${basePath}/${item.id}`}
                  draggable
                  onDragStart={() => setDragId(item.id)}
                  data-dragging={dragId === item.id}
                  className="kanban-card block rounded-lg p-3 bg-white cursor-grab active:cursor-grabbing"
                  style={{ border: "1px solid var(--ink-100)" }}
                >
                  <div className="text-sm font-medium mb-1 line-clamp-2">{item.name}</div>
                  {item.account && <div className="text-xs mb-1.5" style={{ color: "var(--ink-500)" }}>{item.account.name}</div>}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono-num font-semibold">{formatCurrency(item.amount)}</span>
                    <Badge>{item.probability}%</Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs" style={{ color: "var(--ink-400)" }}>
                    <span>{formatDate(item.closeDate || item.expectedCloseDate)}</span>
                    {item.owner && <span>{item.owner.firstName}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
