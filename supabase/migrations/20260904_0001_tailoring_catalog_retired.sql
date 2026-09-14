-- Rebrand store settings and replace the tailoring catalog for Rice n' Rooster.

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

-- 2. Retire the old placeholder "Tailoring" items that aren't part of the new price list
UPDATE public.products p
SET is_active = FALSE, updated_at = NOW()
FROM public.categories c
WHERE p.category_id = c.id
  AND c.name_en = 'Tailoring'
  AND LOWER(BTRIM(p.name)) NOT IN (
    'blouse with lining', 'blouse with lining & cup', 'blouse with stones', 'blouse with laces',
    'blouse with aari laces', 'pavadai sattai for kids', 'pavadai sattai for adults', 'lehenga',
    'semi lehenga', 'punjabi suit without lining', 'punjabi suit with lining', 'falls stitching',
    'valcro stitching', 'falls', 'valcro elastic', 'anarkali without lining', 'anarkali with lining',
    'gown for kids', 'gown for adults', 'men''s short kurta', 'men''s long sleeve short kurta',
    'men''s long jippa', 'men''s pants', 'ladies pants', 'saree pre pleating', 'readymade saree',
    'baju kurong', 'baju malayu', 'aari work blouse', 'cotton lining per mtr',
    'polyester lining per mtr', 'cotton fabric per mtr', 'silk cotton fabric per mtr',
    'silk fabric per mtr', 'readymade blouse'
  );

-- 3. Retire categories not on the Rice n' Rooster list — only Tailoring, Saree, Salwar,
-- and Nighty should remain. Jewellery & Accessories and Posstore came from the old
-- placeholder catalog and are not part of this business.
UPDATE public.products p
SET is_active = FALSE, updated_at = NOW()
FROM public.categories c
WHERE p.category_id = c.id
  AND c.name_en IN ('Jewellery & Accessories', 'Posstore');

UPDATE public.categories
SET is_active = FALSE, updated_at = NOW()
WHERE name_en IN ('Jewellery & Accessories', 'Posstore', 'Sarees, Salwar & Nighty');

-- 4. Saree, Salwar, and Nighty as three standalone categories (custom-priced at
-- billing) — not sub-items grouped under one combined category.
INSERT INTO public.categories (name_en, name_ta, is_active, sort_order)
VALUES
  ('Saree', '', TRUE, 4),
  ('Salwar', '', TRUE, 5),
  ('Nighty', '', TRUE, 6)
ON CONFLICT (name_en) DO UPDATE SET
  is_active = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Move any product rows left over from the old combined "Sarees, Salwar & Nighty"
-- category into their new standalone category of the same name.
UPDATE public.products p
SET category = c.name_en, category_id = c.id, is_active = TRUE, updated_at = NOW()
FROM public.categories c
WHERE c.name_en IN ('Saree', 'Salwar', 'Nighty')
  AND LOWER(BTRIM(p.name)) = LOWER(c.name_en)
  AND p.category_id IS DISTINCT FROM c.id;

-- 5. Rice n' Rooster tailoring price list, split across Tailoring / Saree / Salwar /
-- Nighty per the confirmed category mapping.
WITH catalog(category_name, product_name, price, unit, unit_label, allow_decimal, sort_order) AS (
  VALUES
    -- Tailoring (20)
    ('Tailoring', 'Pavadai Sattai for Kids', 150, 'piece', 'pc', FALSE, 101),
    ('Tailoring', 'Pavadai Sattai for Adults', 200, 'piece', 'pc', FALSE, 102),
    ('Tailoring', 'Lehenga', 250, 'piece', 'pc', FALSE, 103),
    ('Tailoring', 'Semi Lehenga', 150, 'piece', 'pc', FALSE, 104),
    ('Tailoring', 'Valcro Stitching', 60, 'piece', 'pc', FALSE, 105),
    ('Tailoring', 'Valcro Elastic', 20, 'piece', 'pc', FALSE, 106),
    ('Tailoring', 'Gown for Kids', 100, 'piece', 'pc', FALSE, 107),
    ('Tailoring', 'Gown for Adults', 200, 'piece', 'pc', FALSE, 108),
    ('Tailoring', 'Men''s Short Kurta', 100, 'piece', 'pc', FALSE, 109),
    ('Tailoring', 'Men''s Long Sleeve Short Kurta', 150, 'piece', 'pc', FALSE, 110),
    ('Tailoring', 'Men''s Long Jippa', 150, 'piece', 'pc', FALSE, 111),
    ('Tailoring', 'Men''s Pants', 150, 'piece', 'pc', FALSE, 112),
    ('Tailoring', 'Ladies Pants', 150, 'piece', 'pc', FALSE, 113),
    ('Tailoring', 'Baju Kurong', 200, 'piece', 'pc', FALSE, 114),
    ('Tailoring', 'Baju Malayu', 200, 'piece', 'pc', FALSE, 115),
    ('Tailoring', 'Cotton Lining per mtr', 6, 'mtr', 'mtr', TRUE, 116),
    ('Tailoring', 'Polyester Lining per mtr', 6, 'mtr', 'mtr', TRUE, 117),
    ('Tailoring', 'Cotton Fabric per mtr', 10, 'mtr', 'mtr', TRUE, 118),
    ('Tailoring', 'Silk Cotton Fabric per mtr', 30, 'mtr', 'mtr', TRUE, 119),
    ('Tailoring', 'Silk Fabric per mtr', 35, 'mtr', 'mtr', TRUE, 120),
    -- Saree (11)
    ('Saree', 'Blouse with Lining', 90, 'piece', 'pc', FALSE, 201),
    ('Saree', 'Blouse with Lining & Cup', 150, 'piece', 'pc', FALSE, 202),
    ('Saree', 'Blouse with Stones', 150, 'piece', 'pc', FALSE, 203),
    ('Saree', 'Blouse with Laces', 200, 'piece', 'pc', FALSE, 204),
    ('Saree', 'Blouse with Aari Laces', 250, 'piece', 'pc', FALSE, 205),
    ('Saree', 'Falls Stitching', 40, 'piece', 'pc', FALSE, 206),
    ('Saree', 'Falls', 15, 'piece', 'pc', FALSE, 207),
    ('Saree', 'Saree Pre Pleating', 50, 'piece', 'pc', FALSE, 208),
    ('Saree', 'Readymade Saree', 150, 'piece', 'pc', FALSE, 209),
    ('Saree', 'Aari Work Blouse', 2500, 'piece', 'pc', FALSE, 210),
    ('Saree', 'Readymade Blouse', 100, 'piece', 'pc', FALSE, 211),
    ('Saree', 'Saree', 0, 'piece', 'pc', FALSE, 212),
    -- Salwar (4)
    ('Salwar', 'Punjabi Suit without Lining', 100, 'piece', 'pc', FALSE, 301),
    ('Salwar', 'Punjabi Suit with Lining', 150, 'piece', 'pc', FALSE, 302),
    ('Salwar', 'Anarkali without Lining', 150, 'piece', 'pc', FALSE, 303),
    ('Salwar', 'Anarkali with Lining', 200, 'piece', 'pc', FALSE, 304),
    ('Salwar', 'Salwar', 0, 'piece', 'pc', FALSE, 305),
    -- Nighty — no named items on the price list, just the custom-priced catch-all
    ('Nighty', 'Nighty', 0, 'piece', 'pc', FALSE, 401)
), resolved AS (
  SELECT c.id AS category_id, c.name_en AS category_name, catalog.product_name, catalog.price,
         catalog.unit, catalog.unit_label, catalog.allow_decimal, catalog.sort_order
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
  resolved.unit_label,
  resolved.unit,
  1,
  999,
  999,
  999,
  resolved.unit,
  resolved.allow_decimal,
  '[]'::JSONB,
  resolved.product_name || ' service or product',
  TRUE,
  resolved.sort_order
FROM resolved
WHERE NOT EXISTS (
  SELECT 1
  FROM public.products p
  WHERE LOWER(BTRIM(p.name)) = LOWER(BTRIM(resolved.product_name))
);

WITH catalog(category_name, product_name, price, unit, unit_label, allow_decimal, sort_order) AS (
  VALUES
    -- Tailoring (20)
    ('Tailoring', 'Pavadai Sattai for Kids', 150, 'piece', 'pc', FALSE, 101),
    ('Tailoring', 'Pavadai Sattai for Adults', 200, 'piece', 'pc', FALSE, 102),
    ('Tailoring', 'Lehenga', 250, 'piece', 'pc', FALSE, 103),
    ('Tailoring', 'Semi Lehenga', 150, 'piece', 'pc', FALSE, 104),
    ('Tailoring', 'Valcro Stitching', 60, 'piece', 'pc', FALSE, 105),
    ('Tailoring', 'Valcro Elastic', 20, 'piece', 'pc', FALSE, 106),
    ('Tailoring', 'Gown for Kids', 100, 'piece', 'pc', FALSE, 107),
    ('Tailoring', 'Gown for Adults', 200, 'piece', 'pc', FALSE, 108),
    ('Tailoring', 'Men''s Short Kurta', 100, 'piece', 'pc', FALSE, 109),
    ('Tailoring', 'Men''s Long Sleeve Short Kurta', 150, 'piece', 'pc', FALSE, 110),
    ('Tailoring', 'Men''s Long Jippa', 150, 'piece', 'pc', FALSE, 111),
    ('Tailoring', 'Men''s Pants', 150, 'piece', 'pc', FALSE, 112),
    ('Tailoring', 'Ladies Pants', 150, 'piece', 'pc', FALSE, 113),
    ('Tailoring', 'Baju Kurong', 200, 'piece', 'pc', FALSE, 114),
    ('Tailoring', 'Baju Malayu', 200, 'piece', 'pc', FALSE, 115),
    ('Tailoring', 'Cotton Lining per mtr', 6, 'mtr', 'mtr', TRUE, 116),
    ('Tailoring', 'Polyester Lining per mtr', 6, 'mtr', 'mtr', TRUE, 117),
    ('Tailoring', 'Cotton Fabric per mtr', 10, 'mtr', 'mtr', TRUE, 118),
    ('Tailoring', 'Silk Cotton Fabric per mtr', 30, 'mtr', 'mtr', TRUE, 119),
    ('Tailoring', 'Silk Fabric per mtr', 35, 'mtr', 'mtr', TRUE, 120),
    -- Saree (11)
    ('Saree', 'Blouse with Lining', 90, 'piece', 'pc', FALSE, 201),
    ('Saree', 'Blouse with Lining & Cup', 150, 'piece', 'pc', FALSE, 202),
    ('Saree', 'Blouse with Stones', 150, 'piece', 'pc', FALSE, 203),
    ('Saree', 'Blouse with Laces', 200, 'piece', 'pc', FALSE, 204),
    ('Saree', 'Blouse with Aari Laces', 250, 'piece', 'pc', FALSE, 205),
    ('Saree', 'Falls Stitching', 40, 'piece', 'pc', FALSE, 206),
    ('Saree', 'Falls', 15, 'piece', 'pc', FALSE, 207),
    ('Saree', 'Saree Pre Pleating', 50, 'piece', 'pc', FALSE, 208),
    ('Saree', 'Readymade Saree', 150, 'piece', 'pc', FALSE, 209),
    ('Saree', 'Aari Work Blouse', 2500, 'piece', 'pc', FALSE, 210),
    ('Saree', 'Readymade Blouse', 100, 'piece', 'pc', FALSE, 211),
    ('Saree', 'Saree', 0, 'piece', 'pc', FALSE, 212),
    -- Salwar (4)
    ('Salwar', 'Punjabi Suit without Lining', 100, 'piece', 'pc', FALSE, 301),
    ('Salwar', 'Punjabi Suit with Lining', 150, 'piece', 'pc', FALSE, 302),
    ('Salwar', 'Anarkali without Lining', 150, 'piece', 'pc', FALSE, 303),
    ('Salwar', 'Anarkali with Lining', 200, 'piece', 'pc', FALSE, 304),
    ('Salwar', 'Salwar', 0, 'piece', 'pc', FALSE, 305),
    -- Nighty — no named items on the price list, just the custom-priced catch-all
    ('Nighty', 'Nighty', 0, 'piece', 'pc', FALSE, 401)
)
UPDATE public.products p
SET category = c.name_en,
    category_id = c.id,
    price = catalog.price,
    unit = catalog.unit,
    unit_label = catalog.unit_label,
    stock_unit = catalog.unit,
    allow_decimal_quantity = catalog.allow_decimal,
    sort_order = catalog.sort_order,
    is_active = TRUE,
    updated_at = NOW()
FROM catalog
JOIN public.categories c ON LOWER(c.name_en) = LOWER(catalog.category_name)
WHERE LOWER(BTRIM(p.name)) = LOWER(BTRIM(catalog.product_name));

-- 6. Occasion tags — powers the "Shop by Occasion" chips on the homepage,
-- footer, and the Products page filter (public.products.remedy).
WITH tags(product_name, occasion) AS (
  VALUES
    ('Blouse with Lining', 'Casual'),
    ('Blouse with Lining & Cup', 'Party'),
    ('Blouse with Stones', 'Festive'),
    ('Blouse with Laces', 'Bridal'),
    ('Blouse with Aari Laces', 'Bridal'),
    ('Pavadai Sattai for Kids', 'Kids'),
    ('Pavadai Sattai for Adults', 'Festive'),
    ('Lehenga', 'Bridal'),
    ('Semi Lehenga', 'Festive'),
    ('Punjabi Suit without Lining', 'Casual'),
    ('Punjabi Suit with Lining', 'Party'),
    ('Falls Stitching', 'Fabric'),
    ('Valcro Stitching', 'Fabric'),
    ('Falls', 'Fabric'),
    ('Valcro Elastic', 'Fabric'),
    ('Anarkali without Lining', 'Festive'),
    ('Anarkali with Lining', 'Festive'),
    ('Gown for Kids', 'Kids'),
    ('Gown for Adults', 'Party'),
    ('Men''s Short Kurta', 'Casual'),
    ('Men''s Long Sleeve Short Kurta', 'Casual'),
    ('Men''s Long Jippa', 'Festive'),
    ('Men''s Pants', 'Casual'),
    ('Ladies Pants', 'Casual'),
    ('Saree Pre Pleating', 'Fabric'),
    ('Readymade Saree', 'Casual'),
    ('Baju Kurong', 'Festive'),
    ('Baju Malayu', 'Festive'),
    ('Aari Work Blouse', 'Bridal'),
    ('Cotton Lining per mtr', 'Fabric'),
    ('Polyester Lining per mtr', 'Fabric'),
    ('Cotton Fabric per mtr', 'Fabric'),
    ('Silk Cotton Fabric per mtr', 'Fabric'),
    ('Silk Fabric per mtr', 'Fabric'),
    ('Readymade Blouse', 'Casual'),
    ('Saree', 'Casual'),
    ('Salwar', 'Casual'),
    ('Nighty', 'Casual')
)
UPDATE public.products p
SET remedy = ARRAY[tags.occasion],
    updated_at = NOW()
FROM tags
WHERE LOWER(BTRIM(p.name)) = LOWER(BTRIM(tags.product_name));
