CREATE TABLE public.advisory_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  location_name text NOT NULL,
  lat float8 NOT NULL,
  lon float8 NOT NULL,
  verdict text NOT NULL,
  message text NOT NULL
);

GRANT SELECT ON public.advisory_log TO anon;
GRANT SELECT ON public.advisory_log TO authenticated;
GRANT ALL ON public.advisory_log TO service_role;

ALTER TABLE public.advisory_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisory log is publicly readable"
  ON public.advisory_log FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.advisory_log;