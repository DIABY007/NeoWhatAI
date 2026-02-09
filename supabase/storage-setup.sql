-- Configuration du Storage Supabase pour les PDFs
-- Inspiré d'ARAP

-- Créer le bucket raw_documents (à faire manuellement dans le dashboard Supabase)
-- Storage > New bucket > Nom: raw_documents > Private > Create

-- Politiques de stockage pour le bucket raw_documents

-- Supprimer les politiques existantes si elles existent (idempotent)
DROP POLICY IF EXISTS "Service role can manage all PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Clients can upload their own PDFs" ON storage.objects;

-- Politique pour le service role (backend API - peut tout faire)
CREATE POLICY "Service role can manage all PDFs"
ON storage.objects FOR ALL
USING (bucket_id = 'raw_documents')
WITH CHECK (bucket_id = 'raw_documents');

-- Note: Pour un système multi-tenant, on pourrait ajouter des politiques plus restrictives
-- mais pour l'instant, le service role gère tout via l'API backend

