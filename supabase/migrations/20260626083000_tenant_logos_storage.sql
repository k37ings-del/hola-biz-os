-- Create storage bucket for tenant logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tenant-logos', 'tenant-logos', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

-- Storage policies for tenant logos
CREATE POLICY "tenant-logos-insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tenant-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "tenant-logos-select" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'tenant-logos');

-- Add favicon_url column to tenants (optional, generated from logo upload)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS favicon_url TEXT;