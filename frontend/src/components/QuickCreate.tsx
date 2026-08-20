import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, UserPlus, Building2, Users, Target, Handshake, CheckSquare, PhoneCall } from "lucide-react";
import {
  NewLeadModal, NewAccountModal, NewContactModal, NewOpportunityModal, NewDealModal, NewTaskModal, LogActivityModal,
} from "./CreateModals";

type Kind = "lead" | "account" | "contact" | "opportunity" | "deal" | "task" | "activity" | "quote" | null;

const items: { kind: Kind; label: string; icon: any }[] = [
  { kind: "lead", label: "New Lead", icon: UserPlus },
  { kind: "account", label: "New Account", icon: Building2 },
  { kind: "contact", label: "New Contact", icon: Users },
  { kind: "opportunity", label: "New Opportunity", icon: Target },
  { kind: "deal", label: "New Deal", icon: Handshake },
  { kind: "task", label: "New Task", icon: CheckSquare },
  { kind: "activity", label: "Log Activity", icon: PhoneCall },
];

export function QuickCreateButton() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState<Kind>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMenuOpen((v) => !v);
      }
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function pick(kind: Kind) {
    setMenuOpen(false);
    if (kind === "quote") { navigate("/quotes"); return; }
    setActive(kind);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white"
        style={{ background: "var(--ledger-600)" }}
      >
        <Plus size={14} /> Create
        <span className="ml-1 text-[10px] px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.2)" }}>⌘K</span>
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-10 w-56 rounded-lg border shadow-xl bg-white overflow-hidden z-40" style={{ borderColor: "var(--ink-100)" }}>
            {items.map((it) => (
              <button
                key={it.kind}
                onClick={() => pick(it.kind)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-[var(--ink-50)] text-left"
                style={{ color: "var(--ink-700)" }}
              >
                <it.icon size={15} style={{ color: "var(--ink-500)" }} />
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}

      {active === "lead" && <NewLeadModal onClose={() => setActive(null)} onCreated={(l) => navigate(`/leads/${l.id}`)} />}
      {active === "account" && <NewAccountModal onClose={() => setActive(null)} onCreated={(a) => navigate(`/accounts/${a.id}`)} />}
      {active === "contact" && <NewContactModal onClose={() => setActive(null)} onCreated={(c) => navigate(`/contacts/${c.id}`)} />}
      {active === "opportunity" && <NewOpportunityModal onClose={() => setActive(null)} onCreated={(o) => navigate(`/opportunities/${o.id}`)} />}
      {active === "deal" && <NewDealModal onClose={() => setActive(null)} onCreated={(d) => navigate(`/deals/${d.id}`)} />}
      {active === "task" && <NewTaskModal onClose={() => setActive(null)} />}
      {active === "activity" && <LogActivityModal onClose={() => setActive(null)} />}
    </div>
  );
}
