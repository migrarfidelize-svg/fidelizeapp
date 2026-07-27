-- ============ WALLET SETTINGS ============
CREATE TABLE public.wallet_settings (
  establishment_id UUID PRIMARY KEY REFERENCES public.establishments(id) ON DELETE CASCADE,
  google_enabled BOOLEAN NOT NULL DEFAULT true,
  apple_enabled BOOLEAN NOT NULL DEFAULT true,
  logo_url TEXT,
  hero_image_url TEXT,
  background_color TEXT NOT NULL DEFAULT '#5B21B6',
  foreground_color TEXT NOT NULL DEFAULT '#FFFFFF',
  label_color TEXT NOT NULL DEFAULT '#E9D5FF',
  front_text TEXT,
  back_text TEXT,
  custom_message TEXT,
  show_qr BOOLEAN NOT NULL DEFAULT true,
  show_barcode BOOLEAN NOT NULL DEFAULT false,
  barcode_format TEXT NOT NULL DEFAULT 'QR_CODE',
  fields JSONB NOT NULL DEFAULT '{"customer":true,"code":true,"stamps":true,"points":true,"tier":true,"reward":true,"expiry":true,"contact":true}'::jsonb,
  validity_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_settings TO authenticated;
GRANT SELECT ON public.wallet_settings TO anon;
GRANT ALL ON public.wallet_settings TO service_role;

ALTER TABLE public.wallet_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_settings_public_read" ON public.wallet_settings
  FOR SELECT USING (true);

CREATE POLICY "wallet_settings_member_write" ON public.wallet_settings
  FOR ALL TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager') OR public.is_super_admin(auth.uid()));

CREATE TRIGGER wallet_settings_updated_at
  BEFORE UPDATE ON public.wallet_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ WALLET PASSES ============
CREATE TABLE public.wallet_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.loyalty_cards(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('apple','google')),
  serial_number TEXT NOT NULL,
  auth_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  google_object_id TEXT,
  google_class_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, serial_number)
);

CREATE UNIQUE INDEX wallet_passes_unique_customer_platform
  ON public.wallet_passes (customer_id, platform);
CREATE INDEX wallet_passes_est_idx ON public.wallet_passes (establishment_id);

GRANT SELECT ON public.wallet_passes TO authenticated;
GRANT ALL ON public.wallet_passes TO service_role;

ALTER TABLE public.wallet_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_passes_member_read" ON public.wallet_passes
  FOR SELECT TO authenticated
  USING (
    public.has_establishment_access(auth.uid(), establishment_id)
    OR public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid())
  );

CREATE TRIGGER wallet_passes_updated_at
  BEFORE UPDATE ON public.wallet_passes
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ APPLE DEVICE REGISTRATIONS ============
CREATE TABLE public.wallet_pass_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id UUID NOT NULL REFERENCES public.wallet_passes(id) ON DELETE CASCADE,
  device_library_identifier TEXT NOT NULL,
  push_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pass_id, device_library_identifier)
);

GRANT ALL ON public.wallet_pass_devices TO service_role;

ALTER TABLE public.wallet_pass_devices ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER wallet_pass_devices_updated_at
  BEFORE UPDATE ON public.wallet_pass_devices
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();