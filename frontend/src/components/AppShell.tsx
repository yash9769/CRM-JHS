import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, KanbanSquare, Target, Package, Building2, Users,
  Search, ChevronDown, LogOut, FileText,
  Settings, Bell, GitBranch, Menu, X, Layers, PanelLeftClose, PanelLeftOpen
} from "lucide-react";
import { useAuth, canViewOrgChart, roleLabel } from "../hooks/useAuth";
import { initials } from "../lib/format";
import { useState, useEffect, useRef } from "react";
import { useClickOutside } from "../hooks/useClickOutside";
import { api } from "../lib/api";
import { QuickCreateButton } from "./QuickCreate";
import { StageApprovalsWidget } from "./StageApprovalsWidget";
import { StickyNotesWidget } from "./StickyNotesWidget";

const navigationItems = [
  { to: "/",              label: "Dashboard",     icon: LayoutDashboard, exact: true },
  { to: "/pipeline",       label: "Pipeline",      icon: KanbanSquare },
  { to: "/accounts",       label: "Accounts",      icon: Building2 },
  { to: "/opportunities",  label: "Opportunities", icon: Target },
  { to: "/contacts",       label: "Contacts",      icon: Users },
  { to: "/services",       label: "Services",      icon: Layers },
  { to: "/products",       label: "Products",      icon: Package },
  { to: "/quotes",         label: "Quotes",        icon: FileText },
];

function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  useClickOutside(rootRef, open, () => setOpen(false));

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
    <div className="relative" ref={rootRef}>
      <button onClick={openPanel} className="relative p-2 rounded-full hover:bg-[var(--ink-50)] min-h-[44px] min-w-[44px] flex items-center justify-center">
        <Bell size={18} className="text-[var(--ink-500)]" />
        {count > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white bg-[var(--ledger-600)]">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-80 rounded-xl border shadow-xl bg-white overflow-hidden z-50 border-[var(--ink-100)]">
          <div className="px-4 py-3 border-b flex items-center justify-between border-[var(--ink-100)]">
            <span className="text-sm font-semibold">Notifications</span>
            <button onClick={() => setOpen(false)} className="text-xs text-[var(--ink-400)] p-1">Close</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--ink-400)]">No notifications</div>
            ) : notifs.map((n: any) => (
              <div key={n.id} className="px-4 py-3 border-b hover:bg-[var(--ink-50)] text-sm border-[var(--ink-50)]">
                {n.link ? <Link to={n.link} onClick={() => setOpen(false)} className="hover:underline">{n.message}</Link> : n.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 420;
const SIDEBAR_DEFAULT_WIDTH = 224;

export default function AppShell() {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem("crm_sidebar_width"));
      return saved >= SIDEBAR_MIN_WIDTH && saved <= SIDEBAR_MAX_WIDTH ? saved : SIDEBAR_DEFAULT_WIDTH;
    } catch {
      return SIDEBAR_DEFAULT_WIDTH;
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("crm_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(userMenuRef, menuOpen, () => setMenuOpen(false));

  useEffect(() => {
    try { localStorage.setItem("crm_sidebar_width", String(sidebarWidth)); } catch { /* ignore */ }
  }, [sidebarWidth]);

  useEffect(() => {
    try { localStorage.setItem("crm_sidebar_collapsed", String(sidebarCollapsed)); } catch { /* ignore */ }
  }, [sidebarCollapsed]);

  // Ctrl+B (or Cmd+B on Mac) toggles the sidebar, same shortcut as Claude Code / VS Code.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarCollapsed((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function startSidebarResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    setIsResizing(true);
    function onMove(ev: MouseEvent) {
      const next = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, startWidth + (ev.clientX - startX)));
      setSidebarWidth(next);
    }
    function onUp() {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/search?q=${encodeURIComponent(search.trim())}`);
      setSearch("");
      setMobileDrawerOpen(false);
    }
  }

  const renderSidebarContent = (onItemClick?: () => void) => (
    <div className="flex flex-col h-full py-4 px-2">
      <div className="px-3 mb-6 flex items-center justify-between">
        <Link to="/" onClick={onItemClick} className="block">
          <img src="/envista_logo.png" alt="Envista Cyber Defence" className="h-10 w-auto max-w-[180px] object-contain" />
        </Link>
        {onItemClick ? (
          <button onClick={onItemClick} className="text-[var(--ink-400)] hover:text-white p-2">
            <X size={20} />
          </button>
        ) : (
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="hidden md:flex text-[var(--ink-400)] hover:text-white p-2 rounded-md hover:bg-[var(--ink-900)]"
            aria-label="Hide sidebar"
            title="Hide sidebar (Ctrl+B)"
          >
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>

      {/* Navigation items in strictly required order */}
      <div className="space-y-0.5 mb-4">
        {navigationItems.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.to
            : (location.pathname === item.to || location.pathname.startsWith(item.to + "/"));

          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onItemClick}
              className="flex items-center gap-2.5 px-3 py-2 md:py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                backgroundColor: isActive ? "var(--ledger-700)" : "transparent",
                color: isActive ? "white" : "var(--ink-300)",
              }}
            >
              <item.icon size={16} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </div>

      {canViewOrgChart(user) && (
        <div className="mb-4">
          <div className="px-3 mb-1.5 text-[10px] font-semibold tracking-wider uppercase text-[var(--ink-500)]">Team</div>
          <Link
            to="/org-chart"
            onClick={onItemClick}
            className="flex items-center gap-2.5 px-3 py-2 md:py-1.5 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: location.pathname.startsWith("/org-chart") ? "var(--ledger-700)" : "transparent",
              color: location.pathname.startsWith("/org-chart") ? "white" : "var(--ink-300)",
            }}
          >
            <GitBranch size={16} strokeWidth={2} /> Org Chart
          </Link>
        </div>
      )}

      {/* Settings at the bottom of sidebar */}
      <div className="mt-auto pt-3 border-t border-[var(--ink-800)]">
        <Link
          to="/settings"
          onClick={onItemClick}
          className="flex items-center gap-2.5 px-3 py-2 md:py-1.5 rounded-md text-sm font-medium mb-1 transition-colors"
          style={{
            backgroundColor: location.pathname.startsWith("/settings") ? "var(--ledger-700)" : "transparent",
            color: location.pathname.startsWith("/settings") ? "white" : "var(--ink-400)",
          }}
        >
          <Settings size={15} /> Settings
        </Link>
        <div className="px-3 text-[10px] text-[var(--ink-600)]">{tenant?.name}</div>
      </div>
    </div>
  );

  return (
    <div
      className="flex h-screen bg-[var(--paper)]"
      style={isResizing ? { cursor: "col-resize", userSelect: "none" } : undefined}
    >
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex shrink-0 flex-col overflow-y-auto bg-[var(--ink-950)] relative"
        style={{
          width: sidebarCollapsed ? 0 : sidebarWidth,
          minWidth: sidebarCollapsed ? 0 : sidebarWidth,
          transition: isResizing ? "none" : "width 150ms ease, min-width 150ms ease",
        }}
      >
        {!sidebarCollapsed && (
          <>
            {renderSidebarContent()}
            <div
              onMouseDown={startSidebarResize}
              className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-[var(--ledger-600)]/50 active:bg-[var(--ledger-600)]"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
            />
          </>
        )}
      </aside>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setMobileDrawerOpen(false)} />
          <div className="relative w-64 max-w-[80vw] bg-[var(--ink-950)] h-full overflow-y-auto shadow-2xl z-10">
            {renderSidebarContent(() => setMobileDrawerOpen(false))}
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-14 shrink-0 flex items-center justify-between px-3 md:px-5 border-b border-[var(--ink-100)] bg-white">
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-[var(--ink-50)] text-[var(--ink-700)] min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            {sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="hidden md:flex p-2 rounded-lg hover:bg-[var(--ink-50)] text-[var(--ink-700)] min-h-[40px] min-w-[40px] items-center justify-center"
                aria-label="Show sidebar"
                title="Show sidebar (Ctrl+B)"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            <form onSubmit={handleSearch} className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-400)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search accounts, contacts, opportunities…"
                className="w-full pl-9 pr-3 py-2 rounded-lg text-xs md:text-sm border outline-none focus:ring-2 focus:ring-[var(--ledger-600)] focus:border-transparent transition-all border-[var(--ink-200)] bg-[var(--ink-50)] min-h-[40px]"
              />
            </form>
          </div>

          <div className="flex items-center gap-1 md:gap-2 ml-2">
            <StageApprovalsWidget />
            <QuickCreateButton />
            <NotificationBell />
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 p-1 rounded-full hover:bg-[var(--ink-50)] min-h-[44px]"
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-[var(--ink-700)]">
                  {initials(user?.firstName, user?.lastName)}
                </div>
                <ChevronDown size={13} className="text-[var(--ink-400)] hidden sm:block" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-12 w-52 rounded-lg border shadow-lg bg-white overflow-hidden z-50 border-[var(--ink-100)]">
                  <div className="px-3 py-2.5 border-b border-[var(--ink-100)]">
                    <div className="text-sm font-medium">{user?.firstName} {user?.lastName}</div>
                    <div className="text-xs text-[var(--ink-400)] truncate">{user?.email}</div>
                    <div className="text-[10px] mt-0.5 font-semibold text-[var(--ledger-600)]">{roleLabel(user?.orgRole)}</div>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--ink-50)] text-left text-[var(--rose-600)]"
                  >
                    <LogOut size={13} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Global Sticky Notes Widget */}
        <StickyNotesWidget />
      </div>
    </div>
  );
}

