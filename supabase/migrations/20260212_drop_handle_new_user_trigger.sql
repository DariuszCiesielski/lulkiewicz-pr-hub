-- Remove obsolete trigger that blocks user creation
-- The handle_new_user() function tried to insert into organizations/organization_members
-- but the auth service couldn't find the "organizations" table (search_path issue).
-- App uses app_allowed_users for access control, not organizations/organization_members.
-- Error: "Database error saving new user" / SQLSTATE 42P01
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
