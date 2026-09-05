import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth, canViewOrgChart } from "./hooks/useAuth";
import AppShell from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

// Route-level code splitting: only the page the user is actually viewing
// downloads, instead of every page shipping in the initial bundle.
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AccountsPage = lazy(() => import("./pages/AccountsPage"));
const AccountDetailPage = lazy(() => import("./pages/AccountDetailPage"));
const ContactsPage = lazy(() => import("./pages/ContactsPage"));
const ContactDetailPage = lazy(() => import("./pages/ContactDetailPage"));
const OpportunitiesPage = lazy(() => import("./pages/OpportunitiesPage"));
const OpportunityDetailPage = lazy(() => import("./pages/OpportunityDetailPage"));
const PipelinePage = lazy(() => import("./pages/PipelinePage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const QuotesPage = lazy(() => import("./pages/QuotesPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const OrgChartPage = lazy(() => import("./pages/OrgChartPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-[var(--ink-400)]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PageFallback() {
  return (
    <div className="p-8 space-y-4">
      <div className="h-7 w-48 rounded-md animate-pulse" style={{ background: "var(--ink-100)" }} />
      <div className="h-40 rounded-xl animate-pulse" style={{ background: "var(--ink-50)" }} />
    </div>
  );
}

export default function App() {
  const { user } = useAuth();
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/contacts/:id" element={<ContactDetailPage />} />
          <Route path="/opportunities" element={<OpportunitiesPage />} />
          <Route path="/opportunities/:id" element={<OpportunityDetailPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/quotes" element={<QuotesPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/products" element={<ProductsPage />} />
          {/* Reports and Forecasting were merged into the Dashboard -- redirect old links */}
          <Route path="/forecasting" element={<Navigate to="/" replace />} />
          <Route path="/reports" element={<Navigate to="/" replace />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/org-chart" element={canViewOrgChart(user) ? <OrgChartPage /> : <Navigate to="/" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
