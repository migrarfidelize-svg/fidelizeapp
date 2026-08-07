-- Create system_settings table for global platform configuration
CREATE TABLE public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(namespace, key)
);

-- Grant access
GRANT SELECT ON public.system_settings TO authenticated;
GRANT SELECT ON public.system_settings TO anon;
GRANT ALL ON public.system_settings TO service_role;

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "system_settings_read_all" ON public.system_settings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "system_settings_read_anon" ON public.system_settings
    FOR SELECT TO anon USING (true);

CREATE POLICY "system_settings_admin_all" ON public.system_settings
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
        SELECT 1 FROM public.app_roles WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- Updated at trigger
CREATE TRIGGER system_settings_updated BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Initial migration for Voice Studio (ElevenLabs)
-- We check if there's any data in establishment_settings for the fake SYSTEM_ID
-- and move it to system_settings.

DO $$
DECLARE
    voice_config JSONB;
BEGIN
    SELECT security->'elevenlabs_config' INTO voice_config 
    FROM public.establishment_settings 
    WHERE establishment_id = '00000000-0000-0000-0000-000000000000';

    IF voice_config IS NOT NULL THEN
        INSERT INTO public.system_settings (namespace, key, value)
        VALUES ('voice', 'elevenlabs', voice_config)
        ON CONFLICT (namespace, key) DO UPDATE SET value = EXCLUDED.value;
        
        -- Clean up the fake establishment record if needed, 
        -- but keeping it for now to avoid breaking existing code during transition
    END IF;
END $$;
