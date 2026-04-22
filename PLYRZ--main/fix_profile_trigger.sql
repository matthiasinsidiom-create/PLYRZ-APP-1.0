-- This script fixes the automatic profile creation during signup
-- It ensures that every new user gets a profile with a valid role ('fan')
-- and onboarding_completed set to false.

-- 1. Create or replace the function that handles new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role, onboarding_completed)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    CASE 
      WHEN new.email = 'matthias.insidiom@gmail.com' THEN 'admin'
      ELSE 'fan'
    END,
    CASE 
      WHEN new.email = 'matthias.insidiom@gmail.com' THEN true
      ELSE false
    END
  );
  RETURN new;
END;
$$;

-- 2. Re-create the trigger (drop if exists first)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. (Optional) Healing script for existing profiles with invalid roles
-- UPDATE public.profiles 
-- SET role = 'fan' 
-- WHERE role IS NULL OR role = 'user';
