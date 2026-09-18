import { useEffect, useRef, useState, type ReactNode, type ThHTMLAttributes } from "react";

/**
 * Small floating menu shown on right-click of a column header. Positioned at
 * the cursor via `fixed` so it isn't clipped by the table's own scroll
 * container (a `th`'s stacking/overflow context would otherwise cut it off).
 */
function ColumnContextMenu({ x, y, onHide, onClose }: { x: number; y: number; onHide: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("contextmenu", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("contextmenu", handler);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[200] rounded-lg border shadow-xl bg-white py-1 text-xs"
      style={{ left: x, top: y, minWidth: 150, borderColor: "var(--ink-100)" }}
    >
      <button
        type="button"
        onClick={() => {
          onHide();
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 hover:bg-[var(--ink-50)] font-medium"
        style={{ color: "var(--ink-700)" }}
      >
        Hide this column
      </button>
    </div>
  );
}

/**
 * Drop-in replacement for a table `<th>` that adds two interactions on top
 * of whatever the caller already renders inside it:
 *  - drag-and-drop reordering (native HTML5 DnD, so siblings need no shared
 *    state -- the dragged column's key travels via `dataTransfer`)
 *  - right-click -> "Hide this column" (skipped for `permanent` columns)
 */
export function SortableTh({
  colKey,
  children,
  onReorder,
  onHide,
  canHide = true,
  className,
  style,
  ...rest
}: {
  colKey: string;
  children: ReactNode;
  onReorder: (draggedKey: string, targetKey: string) => void;
  onHide?: (key: string) => void;
  canHide?: boolean;
} & ThHTMLAttributes<HTMLTableCellElement>) {
  const [dragOver, setDragOver] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  return (
    <th
      {...rest}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", colKey);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const draggedKey = e.dataTransfer.getData("text/plain");
        if (draggedKey && draggedKey !== colKey) onReorder(draggedKey, colKey);
      }}
      onContextMenu={(e) => {
        if (!onHide || !canHide) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      title="Drag to reorder, right-click to hide"
      className={`${className || ""} cursor-grab active:cursor-grabbing`}
      style={{ ...style, background: dragOver ? "var(--ink-100)" : style?.background }}
    >
      {children}
      {menu && onHide && (
        <ColumnContextMenu
          x={menu.x}
          y={menu.y}
          onHide={() => onHide(colKey)}
          onClose={() => setMenu(null)}
        />
      )}
    </th>
  );
}
