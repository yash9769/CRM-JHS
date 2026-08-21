import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard, KanbanSquare, Target, Handshake, Trophy,
  Package, Building2, Users, Search, ChevronDown, LogOut,
  FileText, Zap, TrendingUp, BarChart2, Settings, Bell, UserPlus,
  CheckSquare,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { initials } from "../lib/format";
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { QuickCreateButton } from "./QuickCreate";

const salesCrmNav = [
  { to: "/accounts",       label: "Accounts",       icon: Building2 },
  { to: "/contacts",       label: "Contacts",       icon: Users },
  { to: "/opportunities",  label: "Opportunities",  icon: Target },
  { to: "/deals",          label: "Deals",          icon: Handshake },
  { to: "/leads",          label: "Leads",          icon: UserPlus },
  { to: "/pipeline",       label: "Pipeline",       icon: KanbanSquare },
  { to: "/deals?won=true", label: "Won Deals",      icon: Trophy },
  { to: "/quotes",         label: "Quotes",         icon: FileText },
  { to: "/products",       label: "Products",       icon: Package },
  { to: "/sequences",      label: "Sequences",      icon: Zap },
  { to: "/tasks",          label: "Tasks",          icon: CheckSquare },
];

const analyticsNav = [
  { to: "/forecasting", label: "Forecasting", icon: TrendingUp },
  { to: "/reports",     label: "Reports",     icon: BarChart2 },
];

function NavSection({ title, items }: { title: string; items: { to: string; label: string; icon: any }[] }) {
  return (
    <div className="mb-4">
      <div className="px-3 mb-1.5 text-[10px] font-semibold tracking-wider uppercase" style={{ color: "var(--ink-500)" }}>{title}</div>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to !== "/deals?won=true"}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={({ isActive }) => ({
              backgroundColor: isActive ? "var(--ledger-700)" : "transparent",
              color: isActive ? "white" : "var(--ink-300)",
            })}
          >
            <item.icon size={15} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await api.get("/notifications/unread-count");
        setCount(r.data.count);
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  async function openPanel() {
    setOpen(true);
    const r = await api.get("/notifications", { params: { pageSize: 10 } });
    setNotifs(r.data.data || []);
    setCount(0);
    await api.post("/notifications/read-all", {});
  }

  return (
    <div className="relative">
      <button onClick={openPanel} className="relative p-1.5 rounded-full hover:bg-[var(--ink-50)]">
        <Bell size={18} style={{ color: "var(--ink-500)" }} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ background: "var(--ledger-600)" }}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-80 rounded-xl border shadow-xl bg-white overflow-hidden z-30" style={{ borderColor: "var(--ink-100)" }} >
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--ink-100)" }}>
            <span className="text-sm font-semibold">Notifications</span>
            <button onClick={() => setOpen(false)} className="text-xs" style={{ color: "var(--ink-400)" }}>Close</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--ink-400)" }}>No notifications</div>
            ) : notifs.map((n: any) => (
              <div key={n.id} className="px-4 py-3 border-b hover:bg-[var(--ink-50)] text-sm" style={{ borderColor: "var(--ink-50)" }}>
                {n.link ? <Link to={n.link} onClick={() => setOpen(false)} className="hover:underline">{n.message}</Link> : n.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppShell() {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) { navigate(`/search?q=${encodeURIComponent(search.trim())}`); setSearch(""); }
  }

  return (
    <div className="flex h-screen" style={{ background: "var(--paper)" }}>
      <aside className="w-56 shrink-0 flex flex-col py-4 px-2 overflow-y-auto" style={{ background: "var(--ink-950)" }}>
        <div className="px-3 mb-6 flex items-center">
          <Link to="/" className="block">
            <img src="/jhs_logo_full_light.png" alt="JHS Logo" className="h-7 object-contain" />
          </Link>
        </div>

        <NavLink to="/" end className="flex items-center gap-2.5 px-3 py-1.5 mb-4 rounded-md text-sm font-medium"
          style={({ isActive }) => ({ backgroundColor: isActive ? "var(--ledger-700)" : "transparent", color: isActive ? "white" : "var(--ink-300)" })}>
          <LayoutDashboard size={15} /> Dashboard
        </NavLink>

        <NavSection title="Sales / CRM" items={salesCrmNav} />
        <NavSection title="Analytics" items={analyticsNav} />

        <div className="mt-auto pt-3 border-t" style={{ borderColor: "var(--ink-800)" }}>
          <NavLink to="/settings" className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm font-medium mb-1"
            style={({ isActive }) => ({ backgroundColor: isActive ? "var(--ledger-700)" : "transparent", color: isActive ? "white" : "var(--ink-400)" })}>
            <Settings size={14} /> Settings
          </NavLink>
          <div className="px-3 text-[10px]" style={{ color: "var(--ink-600)" }}>{tenant?.name}</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-13 shrink-0 flex items-center justify-between px-5 border-b" style={{ borderColor: "var(--ink-100)", background: "white", height: "52px" }}>
          <form onSubmit={handleSearch} className="relative w-full max-w-lg">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-400)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts, contacts, deals…"
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-[var(--ledger-600)] focus:border-transparent transition-all"
              style={{ borderColor: "var(--ink-200)", background: "var(--ink-50)" }} />
          </form>

          <div className="flex items-center gap-2">
            <QuickCreateButton />
            <NotificationBell />
            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full hover:bg-[var(--ink-50)]">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white" style={{ background: "var(--ink-700)" }}>
                  {initials(user?.firstName, user?.lastName)}
                </div>
                <ChevronDown size={13} style={{ color: "var(--ink-400)" }} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 w-44 rounded-lg border shadow-lg bg-white overflow-hidden z-20" style={{ borderColor: "var(--ink-100)" }}>
                  <div className="px-3 py-2.5 border-b" style={{ borderColor: "var(--ink-100)" }}>
                    <div className="text-sm font-medium">{user?.firstName} {user?.lastName}</div>
                    <div className="text-xs" style={{ color: "var(--ink-400)" }}>{user?.email}</div>
                  </div>
                  <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--ink-50)] text-left" style={{ color: "var(--rose-600)" }}>
                    <LogOut size={13} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  );
}
