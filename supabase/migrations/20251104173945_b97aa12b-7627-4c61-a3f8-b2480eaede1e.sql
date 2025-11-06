-- Fix security warning by setting search_path on existing function using CASCADE
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;

-- Recreate the trigger
CREATE TRIGGER update_user_google_credentials_updated_at
  BEFORE UPDATE ON public.user_google_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();