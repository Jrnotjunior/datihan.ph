-- Product image gallery: keep image_url as the primary/first image for backwards compatibility.
alter table public.products
  add column if not exists image_urls jsonb not null default '[]'::jsonb;

-- Backfill existing products that already have a single image.
update public.products
set image_urls = jsonb_build_array(image_url)
where (image_urls = '[]'::jsonb)
  and image_url is not null
  and btrim(image_url) <> '';

-- Database-level protection for the maximum of 8 photos.
alter table public.products
  drop constraint if exists products_image_urls_max_8;

alter table public.products
  add constraint products_image_urls_max_8
  check (
    jsonb_typeof(image_urls) = 'array'
    and jsonb_array_length(image_urls) <= 8
  );

comment on column public.products.image_urls is
  'Public product photo URLs in display order; Shop Owner UI requires 1-8 photos for products being added or saved.';
