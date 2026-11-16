-- Platform support contact for subscription renewal / lock screens

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS support_email TEXT,
  ADD COLUMN IF NOT EXISTS support_phone TEXT;
