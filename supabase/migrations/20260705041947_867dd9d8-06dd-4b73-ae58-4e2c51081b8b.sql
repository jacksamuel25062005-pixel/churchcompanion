
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings super admin read" ON public.app_settings
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "app_settings super admin write" ON public.app_settings
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS public.code_execution_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_label TEXT,
  files_changed JSONB NOT NULL DEFAULT '[]'::jsonb,
  compatibility_status TEXT,
  security_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  performance_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  break_risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  build_success BOOLEAN,
  stopped_early BOOLEAN NOT NULL DEFAULT FALSE,
  stop_reason TEXT
);
GRANT SELECT ON public.code_execution_reports TO authenticated;
GRANT ALL ON public.code_execution_reports TO service_role;
ALTER TABLE public.code_execution_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "code_execution_reports super admin read" ON public.code_execution_reports
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'super_admin'));
