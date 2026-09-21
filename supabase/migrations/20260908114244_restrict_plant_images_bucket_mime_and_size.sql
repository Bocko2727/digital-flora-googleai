UPDATE storage.buckets SET file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'] WHERE id = 'plant-images';
