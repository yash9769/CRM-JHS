-- Adds SUPER_ADMIN to the OrgRole enum. This is a cross-tenant platform
-- role: it can view/manage every tenant (via an explicit tenant-switch
-- header, checked server-side) rather than being scoped to the tenant it
-- happens to belong to. No existing rows are affected by this migration --
-- it only widens the enum.
ALTER TYPE "OrgRole" ADD VALUE 'SUPER_ADMIN';
