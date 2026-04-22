-- This script fixes the "Database error saving new user" issue
-- It ensures that the trigger function is robust and doesn't block signup if it fails.
-- It also enforces the new role model ('admin', 'player', 'fan').

-- 1. Create or replace the function that handles new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_onboarding_completed BOOLEAN;
BEGIN
  -- Determine role based on email
  IF new.email = 'matthias.insidiom@gmail.com' THEN
    v_role := 'admin';
    v_onboarding_completed := true;
  ELSE
    v_role := 'fan';
    v_onboarding_completed := false;
  END IF;

  -- Insert into profiles
  -- We use a robust insert that handles the new mandatory 'role' field
  -- and the 'onboarding_completed' field.
  INSERT INTO public.profiles (id, display_name, role, onboarding_completed)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    v_role,
    v_onboarding_completed
  );

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- CRITICAL: If the insert fails, we still want the user to be created in auth.users
  -- The app will then try to create the profile manually in AuthContext.tsx (healing mechanism)
  -- This prevents the "Database error saving new user" from blocking signup.
  RETURN new;
END;
$$;

-- 2. Re-create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Healing script for existing profiles
-- Ensure all profiles have a valid role and no 'user' roles exist
UPDATE public.profiles 
SET role = 'fan' 
WHERE role IS NULL OR role = 'user';

-- Ensure admin email has admin role
UPDATE public.profiles
SET role = 'admin', onboarding_completed = true
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'matthias.insidiom@gmail.com'
);
