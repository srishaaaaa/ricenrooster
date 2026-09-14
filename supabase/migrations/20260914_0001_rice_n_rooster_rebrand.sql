-- Rebrand store settings and replace the tailoring catalog with the
-- Rice n' Rooster fried rice / specialty chicken combo menu.

-- 1. Store settings (name, contact, address shown across invoices/UI)
INSERT INTO public.store_settings (id, name, owner_name, phone, email, address)
VALUES (
  1,
  'Rice n'' Rooster',
  'Sankaranarayanan. S',
  '+91 93634 00210',
  'ricenrooster@gmail.com',
  '1st floor, 14/A, Water Tank Rd, MMDA Colony, Arumbakkam, Chennai, Tamil Nadu 600106'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  owner_name = EXCLUDED.owner_name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  address = EXCLUDED.address,
  updated_at = NOW();

-- 2. Retire the old tailoring catalog — Tailoring, Saree,
-- Salwar, and Nighty are no longer part of this business.
UPDATE public.products p
SET is_active = FALSE, updated_at = NOW()
FROM public.categories c
WHERE p.category_id = c.id
  AND c.name_en IN ('Tailoring', 'Saree', 'Salwar', 'Nighty');

UPDATE public.categories
SET is_active = FALSE, updated_at = NOW()
WHERE name_en IN ('Tailoring', 'Saree', 'Salwar', 'Nighty');

-- 3. New categories for the Rice n' Rooster menu.
INSERT INTO public.categories (name_en, name_ta, is_active, sort_order)
VALUES
  ('Fried Rice', '', TRUE, 1),
  ('Specialty Chicken Combos', '', TRUE, 2)
ON CONFLICT (name_en) DO UPDATE SET
  is_active = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- 4. Menu items.
WITH catalog(category_name, product_name, price, sort_order) AS (
  VALUES
    -- Fried Rice
    ('Fried Rice', 'Indo Chinese Fried Rice (Veg & Chicken)', 140, 101),
    ('Fried Rice', 'Thai Street Fried Rice (Veg & Chicken)', 170, 102),
    ('Fried Rice', 'Basil Fried Rice (Veg & Chicken)', 170, 103),
    ('Fried Rice', 'Nasi Goreng (Veg & Chicken)', 170, 104),
    ('Fried Rice', 'Hakka Fried Rice (Veg & Chicken)', 140, 105),
    -- Specialty Chicken Combos
    ('Specialty Chicken Combos', 'Gochujang Korean Fried Chicken with Kimchi Fried Rice', 300, 201),
    ('Specialty Chicken Combos', 'Chicken 65 with Ghee Rice', 300, 202),
    ('Specialty Chicken Combos', 'Thai Crispy Chicken Wings with Curried Fried Rice', 300, 203),
    ('Specialty Chicken Combos', 'Shish Tawook with Middle Eastern Fried Rice', 300, 204),
    ('Specialty Chicken Combos', 'Spicy Chicken Skewers with Mexican Fried Rice', 300, 205),
    ('Specialty Chicken Combos', 'Desi Barbeque Chicken with Masala Fried Rice', 300, 206),
    ('Specialty Chicken Combos', 'Spicy Chinese Chicken Balls with Pepper Fried Rice', 300, 207),
    ('Specialty Chicken Combos', 'Jerk Chicken with Garlic Fried Rice', 300, 208)
), resolved AS (
  SELECT c.id AS category_id, c.name_en AS category_name, catalog.product_name, catalog.price,
         catalog.sort_order
  FROM catalog
  JOIN public.categories c ON LOWER(c.name_en) = LOWER(catalog.category_name)
)
INSERT INTO public.products (
  name, category, category_id, price, purchase_price, mrp, unit_type, unit_label,
  unit, base_quantity, stock_quantity, opening_stock, stock, stock_unit,
  allow_decimal_quantity, predefined_options, description, is_active, sort_order
)
SELECT
  resolved.product_name,
  resolved.category_name,
  resolved.category_id,
  resolved.price,
  0,
  0,
  'unit',
  'plate',
  'plate',
  1,
  999,
  999,
  999,
  'plate',
  FALSE,
  '[]'::JSONB,
  resolved.product_name || ' — freshly prepared',
  TRUE,
  resolved.sort_order
FROM resolved
WHERE NOT EXISTS (
  SELECT 1
  FROM public.products p
  WHERE LOWER(BTRIM(p.name)) = LOWER(BTRIM(resolved.product_name))
);

WITH catalog(category_name, product_name, price, sort_order) AS (
  VALUES
    ('Fried Rice', 'Indo Chinese Fried Rice (Veg & Chicken)', 140, 101),
    ('Fried Rice', 'Thai Street Fried Rice (Veg & Chicken)', 170, 102),
    ('Fried Rice', 'Basil Fried Rice (Veg & Chicken)', 170, 103),
    ('Fried Rice', 'Nasi Goreng (Veg & Chicken)', 170, 104),
    ('Fried Rice', 'Hakka Fried Rice (Veg & Chicken)', 140, 105),
    ('Specialty Chicken Combos', 'Gochujang Korean Fried Chicken with Kimchi Fried Rice', 300, 201),
    ('Specialty Chicken Combos', 'Chicken 65 with Ghee Rice', 300, 202),
    ('Specialty Chicken Combos', 'Thai Crispy Chicken Wings with Curried Fried Rice', 300, 203),
    ('Specialty Chicken Combos', 'Shish Tawook with Middle Eastern Fried Rice', 300, 204),
    ('Specialty Chicken Combos', 'Spicy Chicken Skewers with Mexican Fried Rice', 300, 205),
    ('Specialty Chicken Combos', 'Desi Barbeque Chicken with Masala Fried Rice', 300, 206),
    ('Specialty Chicken Combos', 'Spicy Chinese Chicken Balls with Pepper Fried Rice', 300, 207),
    ('Specialty Chicken Combos', 'Jerk Chicken with Garlic Fried Rice', 300, 208)
)
UPDATE public.products p
SET category = c.name_en,
    category_id = c.id,
    price = catalog.price,
    unit = 'plate',
    unit_label = 'plate',
    stock_unit = 'plate',
    sort_order = catalog.sort_order,
    is_active = TRUE,
    updated_at = NOW()
FROM catalog
JOIN public.categories c ON LOWER(c.name_en) = LOWER(catalog.category_name)
WHERE LOWER(BTRIM(p.name)) = LOWER(BTRIM(catalog.product_name));

-- 5. Flavour tags — powers the "Shop by Flavour" chips on the homepage,
-- footer, and the Products page filter (public.products.remedy).
WITH tags(product_name, occasion) AS (
  VALUES
    ('Indo Chinese Fried Rice (Veg & Chicken)', 'Fried Rice'),
    ('Thai Street Fried Rice (Veg & Chicken)', 'Fried Rice'),
    ('Basil Fried Rice (Veg & Chicken)', 'Fried Rice'),
    ('Nasi Goreng (Veg & Chicken)', 'Fried Rice'),
    ('Hakka Fried Rice (Veg & Chicken)', 'Fried Rice'),
    ('Gochujang Korean Fried Chicken with Kimchi Fried Rice', 'Chicken Combo'),
    ('Chicken 65 with Ghee Rice', 'Chicken Combo'),
    ('Thai Crispy Chicken Wings with Curried Fried Rice', 'Chicken Combo'),
    ('Shish Tawook with Middle Eastern Fried Rice', 'Chicken Combo'),
    ('Spicy Chicken Skewers with Mexican Fried Rice', 'Chicken Combo'),
    ('Desi Barbeque Chicken with Masala Fried Rice', 'Chicken Combo'),
    ('Spicy Chinese Chicken Balls with Pepper Fried Rice', 'Chicken Combo'),
    ('Jerk Chicken with Garlic Fried Rice', 'Chicken Combo')
)
UPDATE public.products p
SET remedy = ARRAY[tags.occasion],
    updated_at = NOW()
FROM tags
WHERE LOWER(BTRIM(p.name)) = LOWER(BTRIM(tags.product_name));

-- Secondary flavour tags (appended) for items that fit more than one chip.
UPDATE public.products SET remedy = ARRAY['Chicken Combo', 'Korean'], updated_at = NOW()
  WHERE LOWER(BTRIM(name)) = LOWER('Gochujang Korean Fried Chicken with Kimchi Fried Rice');
UPDATE public.products SET remedy = ARRAY['Chicken Combo', 'Bestseller'], updated_at = NOW()
  WHERE LOWER(BTRIM(name)) = LOWER('Chicken 65 with Ghee Rice');
UPDATE public.products SET remedy = ARRAY['Chicken Combo', 'Spicy'], updated_at = NOW()
  WHERE LOWER(BTRIM(name)) = LOWER('Thai Crispy Chicken Wings with Curried Fried Rice');
UPDATE public.products SET remedy = ARRAY['Chicken Combo', 'Middle Eastern'], updated_at = NOW()
  WHERE LOWER(BTRIM(name)) = LOWER('Shish Tawook with Middle Eastern Fried Rice');
UPDATE public.products SET remedy = ARRAY['Chicken Combo', 'Spicy'], updated_at = NOW()
  WHERE LOWER(BTRIM(name)) = LOWER('Spicy Chicken Skewers with Mexican Fried Rice');
UPDATE public.products SET remedy = ARRAY['Chicken Combo', 'Bestseller'], updated_at = NOW()
  WHERE LOWER(BTRIM(name)) = LOWER('Desi Barbeque Chicken with Masala Fried Rice');
UPDATE public.products SET remedy = ARRAY['Chicken Combo', 'Spicy'], updated_at = NOW()
  WHERE LOWER(BTRIM(name)) = LOWER('Spicy Chinese Chicken Balls with Pepper Fried Rice');
