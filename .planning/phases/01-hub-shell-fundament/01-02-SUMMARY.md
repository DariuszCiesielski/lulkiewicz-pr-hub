# Plan 01-02 Summary: System ról admin/user + panel admina

## Status: COMPLETE

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Tabela Supabase + RLS + AuthContext permissions | f32245f | src/types/index.ts, src/contexts/AuthContext.tsx |
| 2 | API routes + panel admina UI | f32245f | src/app/api/admin/\*, src/app/(hub)/admin/\*, src/components/admin/\* |

## Deliverables

- **Tabela `app_allowed_users`**: email, user_id, role (admin/user), allowed_tools[], display_name
- **RLS**: users read own record, admins can do everything
- **`is_admin()` SECURITY DEFINER**: unika rekurencji RLS
- **Pierwszy admin**: dariusz.ciesielski.71@gmail.com (UUID: a3e6f759-7167-4470-b456-54f3828938e6)
- **AuthContext**: userRole, allowedTools, isAdmin, hasAccess, canAccessTool(), refreshPermissions()
- **API GET /api/admin/users**: lista użytkowników (wymaga admina)
- **API PUT /api/admin/users**: aktualizacja roli/narzędzi/nazwy
- **API DELETE /api/admin/users**: usunięcie użytkownika
- **API POST /api/admin/create-user**: tworzenie (hasło tymczasowe lub zaproszenie email)
- **Panel admina /admin**: tabela użytkowników + formularz dodawania/edycji + kontrola dostępu do narzędzi
- **Admin guard (layout.tsx)**: redirect non-admins na /dashboard

## Database Changes (via Supabase Management API)

- CREATE TABLE app_allowed_users
- CREATE FUNCTION update_updated_at_column() + trigger
- ALTER TABLE ENABLE ROW LEVEL SECURITY
- CREATE FUNCTION is_admin() SECURITY DEFINER STABLE
- CREATE POLICY "Users can read own record" (SELECT)
- CREATE POLICY "Admins can do everything" (ALL)
- INSERT first admin record

## Decisions

- Service role client (SUPABASE_SERVICE_ROLE_KEY) do operacji admin — nie @supabase/ssr
- "Jasna wyspa" style dla modali (bg-white w ciemnym overlay)
- 6 narzędzi: email-analyzer + tool-2..tool-6 (placeholders na fazę 2+)
- Dwa tryby tworzenia usera: hasło tymczasowe (createUser) lub zaproszenie (inviteUserByEmail)

## Verification

- [x] npm run build passes (10 routes)
- [x] API routes compiled as dynamic (ƒ)
- [x] Admin page compiled as static (○)
- [x] All TypeScript checks pass
- [x] DB table exists with RLS + policies + admin record
