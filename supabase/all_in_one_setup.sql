-- FILE: 20260716_0001_store_schema.sql
-- ═══════════════════════════════════════════════════════════
-- Rice n' Rooster billing schema.
-- Safe to run against a fresh project or the existing Rice n' Rooster project.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_code TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  mobile TEXT NOT NULL DEFAULT '',
  email TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS public.customer_code_seq START WITH 1;

CREATE TABLE IF NOT EXISTS public.categories (
  id BIGSERIAL PRIMARY KEY,
  name_en TEXT NOT NULL UNIQUE,
  name_ta TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_ta TEXT NOT NULL DEFAULT '',
  tamil_name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  category_id BIGINT REFERENCES public.categories(id) ON DELETE SET NULL,
  remedy TEXT[] NOT NULL DEFAULT '{}',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  offer_price NUMERIC(12,2),
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  mrp NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  unit_type TEXT NOT NULL DEFAULT 'unit' CHECK (unit_type IN ('unit', 'weight', 'volume', 'bundle')),
  unit_label TEXT NOT NULL DEFAULT 'piece',
  unit TEXT NOT NULL DEFAULT 'piece',
  base_quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  stock_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  opening_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  stock_unit TEXT NOT NULL DEFAULT 'piece',
  low_stock_alert NUMERIC(12,3) NOT NULL DEFAULT 5,
  allow_decimal_quantity BOOLEAN NOT NULL DEFAULT FALSE,
  predefined_options JSONB NOT NULL DEFAULT '[]'::JSONB,
  description TEXT NOT NULL DEFAULT '',
  description_ta TEXT NOT NULL DEFAULT '',
  benefits TEXT NOT NULL DEFAULT '',
  benefits_ta TEXT NOT NULL DEFAULT '',
  image TEXT,
  image_url TEXT,
  sku TEXT,
  barcode TEXT,
  brand TEXT,
  supplier TEXT,
  size TEXT,
  color TEXT,
  rating NUMERIC(3,1) NOT NULL DEFAULT 5,
  has_variants BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS products_category_name_unique
  ON public.products (category_id, LOWER(BTRIM(name)));

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  size_label TEXT,
  weight_value NUMERIC(12,3),
  weight_unit TEXT,
  sku TEXT,
  barcode TEXT,
  purchase_price NUMERIC(12,2),
  mrp NUMERIC(12,2),
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  group_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_product_name_unique
  ON public.product_variants (product_id, LOWER(BTRIM(variant_name)));

CREATE TABLE IF NOT EXISTS public.coupons (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expiry_date TIMESTAMPTZ,
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  min_order_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_upper_unique ON public.coupons (UPPER(BTRIM(code)));

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT 'Customer',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  order_mode TEXT NOT NULL DEFAULT 'offline',
  order_type TEXT NOT NULL DEFAULT 'pos_sale',
  delivery_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  manual_discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  manual_discount_type TEXT NOT NULL DEFAULT 'flat',
  manual_discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  coupon_code TEXT,
  coupon_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_gst NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  payment_mode TEXT NOT NULL DEFAULT 'cash',
  split_details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL DEFAULT 'Product',
  name TEXT NOT NULL DEFAULT 'Product',
  product_tamil_name TEXT,
  tamil_name TEXT,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'piece',
  unit_type TEXT NOT NULL DEFAULT 'unit',
  base_quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoice_counter (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  counter BIGINT NOT NULL DEFAULT 0,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.invoice_counter (id, counter, year)
VALUES (1, 0, EXTRACT(YEAR FROM NOW())::INTEGER)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.store_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'Rice n'' Rooster',
  owner_name TEXT NOT NULL DEFAULT 'Sankaranarayanan. S',
  phone TEXT NOT NULL DEFAULT '+91 93634 00210',
  email TEXT NOT NULL DEFAULT 'ricenrooster@gmail.com',
  address TEXT NOT NULL DEFAULT '1st floor, 14/A, Water Tank Rd, MMDA Colony, Arumbakkam, Chennai, Tamil Nadu 600106',
  gst_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := CASE WHEN COALESCE(NEW.raw_user_meta_data ->> 'role', '') = 'admin' THEN 'admin' ELSE 'customer' END;
BEGIN
  INSERT INTO public.profiles (id, customer_code, name, mobile, email, role)
  VALUES (
    NEW.id,
    'CUST-' || LPAD(nextval('public.customer_code_seq')::TEXT, 5, '0'),
    COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'name'), ''), split_part(COALESCE(NEW.email, ''), '@', 1), 'Customer'),
    COALESCE(NEW.raw_user_meta_data ->> 'mobile', ''),
    NEW.email,
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    mobile = EXCLUDED.mobile,
    email = EXCLUDED.email,
    updated_at = NOW();

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::JSONB) || jsonb_build_object('role', v_role)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.sync_product_category_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    SELECT name_en INTO NEW.category FROM public.categories WHERE id = NEW.category_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_product_category_name_trigger ON public.products;
CREATE TRIGGER sync_product_category_name_trigger
BEFORE INSERT OR UPDATE OF category_id ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_product_category_name();

CREATE OR REPLACE FUNCTION public.sync_category_name_to_products()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name_en IS DISTINCT FROM OLD.name_en THEN
    UPDATE public.products SET category = NEW.name_en, updated_at = NOW() WHERE category_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_category_name_to_products_trigger ON public.categories;
CREATE TRIGGER sync_category_name_to_products_trigger
AFTER UPDATE OF name_en ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.sync_category_name_to_products();

CREATE OR REPLACE FUNCTION public.ensure_one_default_variant()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.product_variants
    SET is_default = FALSE, updated_at = NOW()
    WHERE product_id = NEW.product_id AND id <> NEW.id AND is_default;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_one_default_variant_trigger ON public.product_variants;
CREATE TRIGGER ensure_one_default_variant_trigger
AFTER INSERT OR UPDATE OF is_default ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.ensure_one_default_variant();

CREATE OR REPLACE FUNCTION public.get_next_invoice_no()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_counter BIGINT;
  v_existing_max BIGINT;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(invoice_no FROM '^PB-' || v_year || '-([0-9]+)$')::BIGINT), 0)
  INTO v_existing_max
  FROM public.orders
  WHERE invoice_no ~ ('^PB-' || v_year || '-[0-9]+$');

  INSERT INTO public.invoice_counter (id, counter, year)
  VALUES (1, 1, v_year)
  ON CONFLICT (id) DO UPDATE SET
    counter = CASE
      WHEN public.invoice_counter.year = v_year
        THEN GREATEST(public.invoice_counter.counter, v_existing_max) + 1
      ELSE 1
    END,
    year = v_year,
    updated_at = NOW()
  RETURNING counter INTO v_counter;

  RETURN 'PB-' || v_year || '-' || LPAD(v_counter::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.create_order_with_stock(
  p_customer_name TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_items JSONB,
  p_shipping NUMERIC DEFAULT 0,
  p_status TEXT DEFAULT 'pending',
  p_order_mode TEXT DEFAULT 'offline',
  p_order_type TEXT DEFAULT 'pos_sale',
  p_delivery_charge NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_manual_discount_amount NUMERIC DEFAULT 0,
  p_manual_discount_type TEXT DEFAULT 'flat',
  p_manual_discount_value NUMERIC DEFAULT 0,
  p_coupon_code TEXT DEFAULT NULL,
  p_coupon_percentage NUMERIC DEFAULT 0,
  p_total_gst NUMERIC DEFAULT 0,
  p_gst_enabled BOOLEAN DEFAULT FALSE,
  p_payment_method TEXT DEFAULT 'cash',
  p_split_details JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_no TEXT;
  v_order_id UUID;
  v_subtotal NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2);
  v_item JSONB;
  v_product_id BIGINT;
  v_variant_id UUID;
  v_attempt INTEGER;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal + COALESCE((v_item ->> 'line_total')::NUMERIC, 0);
  END LOOP;

  v_total := GREATEST(
    0,
    v_subtotal + COALESCE(p_total_gst, 0) + COALESCE(p_delivery_charge, 0) + COALESCE(p_shipping, 0)
      - COALESCE(p_discount_amount, 0) - COALESCE(p_manual_discount_amount, 0)
  );

  FOR v_attempt IN 1..5 LOOP
    v_invoice_no := public.get_next_invoice_no();
    BEGIN
      INSERT INTO public.orders (
        invoice_no, user_id, customer_name, phone, address, items, subtotal, shipping, total,
        status, order_mode, order_type, delivery_charge, discount_amount, manual_discount_amount,
        manual_discount_type, manual_discount_value, coupon_code, coupon_percentage, total_gst,
        gst_amount, gst_enabled, payment_method, payment_mode, split_details
      ) VALUES (
        v_invoice_no, auth.uid(), COALESCE(NULLIF(BTRIM(p_customer_name), ''), 'Customer'),
        COALESCE(BTRIM(p_phone), ''), COALESCE(BTRIM(p_address), ''), p_items, v_subtotal,
        COALESCE(p_shipping, 0), v_total, COALESCE(NULLIF(BTRIM(p_status), ''), 'pending'),
        COALESCE(NULLIF(BTRIM(p_order_mode), ''), 'offline'), COALESCE(NULLIF(BTRIM(p_order_type), ''), 'pos_sale'),
        COALESCE(p_delivery_charge, 0), COALESCE(p_discount_amount, 0), COALESCE(p_manual_discount_amount, 0),
        COALESCE(NULLIF(BTRIM(p_manual_discount_type), ''), 'flat'), COALESCE(p_manual_discount_value, 0),
        NULLIF(BTRIM(COALESCE(p_coupon_code, '')), ''), COALESCE(p_coupon_percentage, 0),
        COALESCE(p_total_gst, 0), COALESCE(p_total_gst, 0), COALESCE(p_gst_enabled, FALSE),
        COALESCE(NULLIF(BTRIM(p_payment_method), ''), 'cash'), COALESCE(NULLIF(BTRIM(p_payment_method), ''), 'cash'),
        COALESCE(p_split_details, '{}'::JSONB)
      ) RETURNING id INTO v_order_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_product_id := NULLIF(COALESCE(v_item ->> 'product_id', v_item ->> 'id'), '')::BIGINT;
    v_variant_id := NULLIF(v_item ->> 'variant_id', '')::UUID;

    INSERT INTO public.order_items (
      order_id, product_id, variant_id, product_name, name, product_tamil_name, tamil_name,
      quantity, unit, unit_type, base_quantity, base_price, line_total, image_url, is_manual,
      discount, gst_amount, gst_rate
    ) VALUES (
      v_order_id, v_product_id, v_variant_id,
      COALESCE(NULLIF(v_item ->> 'name', ''), 'Product'), COALESCE(NULLIF(v_item ->> 'name', ''), 'Product'),
      NULLIF(v_item ->> 'tamil_name', ''), NULLIF(v_item ->> 'tamil_name', ''),
      COALESCE((v_item ->> 'quantity')::NUMERIC, 0), COALESCE(NULLIF(v_item ->> 'unit', ''), 'piece'),
      COALESCE(NULLIF(v_item ->> 'unit_type', ''), 'unit'), COALESCE((v_item ->> 'base_quantity')::NUMERIC, 1),
      COALESCE((v_item ->> 'base_price')::NUMERIC, 0), COALESCE((v_item ->> 'line_total')::NUMERIC, 0),
      NULLIF(v_item ->> 'image_url', ''), COALESCE(v_item ->> 'source' = 'manual', FALSE),
      COALESCE((v_item ->> 'discount')::NUMERIC, 0), COALESCE((v_item ->> 'gst_amount')::NUMERIC, 0),
      COALESCE((v_item ->> 'gst_rate')::NUMERIC, 0)
    );

    IF v_product_id IS NOT NULL THEN
      UPDATE public.products
      SET stock_quantity = GREATEST(stock_quantity - COALESCE((v_item ->> 'quantity')::NUMERIC, 0), 0),
          stock = GREATEST(FLOOR(stock_quantity - COALESCE((v_item ->> 'quantity')::NUMERIC, 0)), 0)::INTEGER,
          updated_at = NOW()
      WHERE id = v_product_id;
    END IF;

    IF v_variant_id IS NOT NULL THEN
      UPDATE public.product_variants
      SET stock = GREATEST(stock - COALESCE((v_item ->> 'quantity')::NUMERIC, 0), 0), updated_at = NOW()
      WHERE id = v_variant_id;
    END IF;
  END LOOP;

  IF NULLIF(BTRIM(COALESCE(p_coupon_code, '')), '') IS NOT NULL THEN
    UPDATE public.coupons
    SET usage_count = usage_count + 1, updated_at = NOW()
    WHERE UPPER(BTRIM(code)) = UPPER(BTRIM(p_coupon_code))
      AND is_active
      AND (usage_limit IS NULL OR usage_count < usage_limit);
  END IF;

  RETURN jsonb_build_object('orderId', v_order_id, 'invoiceNo', v_invoice_no, 'createdAt', NOW());
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_invoice_by_number(p_invoice_no TEXT)
RETURNS SETOF public.orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.orders WHERE invoice_no = NULLIF(BTRIM(p_invoice_no), '') LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_invoice_by_number(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_by_number(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock(
  TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC,
  TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC, BOOLEAN, TEXT, JSONB
) TO anon, authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_portal_manage ON public.profiles;
CREATE POLICY profiles_portal_manage ON public.profiles FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS categories_portal_manage ON public.categories;
CREATE POLICY categories_portal_manage ON public.categories FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS products_portal_manage ON public.products;
CREATE POLICY products_portal_manage ON public.products FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS product_variants_portal_manage ON public.product_variants;
CREATE POLICY product_variants_portal_manage ON public.product_variants FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS coupons_portal_manage ON public.coupons;
CREATE POLICY coupons_portal_manage ON public.coupons FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS orders_portal_manage ON public.orders;
CREATE POLICY orders_portal_manage ON public.orders FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS order_items_portal_manage ON public.order_items;
CREATE POLICY order_items_portal_manage ON public.order_items FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS store_settings_portal_manage ON public.store_settings;
CREATE POLICY store_settings_portal_manage ON public.store_settings FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoices', 'invoices', TRUE, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = TRUE, file_size_limit = 10485760, allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS invoices_public_read ON storage.objects;
CREATE POLICY invoices_public_read ON storage.objects FOR SELECT TO public USING (bucket_id = 'invoices');
DROP POLICY IF EXISTS invoices_portal_upload ON storage.objects;
CREATE POLICY invoices_portal_upload ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'invoices');
DROP POLICY IF EXISTS invoices_portal_update ON storage.objects;
CREATE POLICY invoices_portal_update ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'invoices') WITH CHECK (bucket_id = 'invoices');

CREATE INDEX IF NOT EXISTS products_category_id_idx ON public.products(category_id);
CREATE INDEX IF NOT EXISTS products_active_sort_idx ON public.products(is_active, sort_order);
CREATE INDEX IF NOT EXISTS variants_product_id_idx ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_phone_idx ON public.orders(phone);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items(order_id);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;


-- FILE: 20260716_0002_store_catalog.sql
-- ═══════════════════════════════════════════════════════════
-- Rice n' Rooster initial catalog. Existing matching products are preserved.

INSERT INTO public.categories (name_en, name_ta, is_active, sort_order)
VALUES
  ('Tailoring', '', TRUE, 1),
  ('Jewellery & Accessories', '', TRUE, 2),
  ('Posstore', '', TRUE, 3)
ON CONFLICT (name_en) DO UPDATE SET
  is_active = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

WITH catalog(category_name, product_name, sort_order) AS (
  VALUES
    ('Tailoring', 'Saree Blouse', 101),
    ('Tailoring', 'Saree Blouse + Cup', 102),
    ('Tailoring', 'Readymade Saree', 103),
    ('Tailoring', 'Punjabi Suit', 104),
    ('Tailoring', 'Punjabi Suit + Salwar', 105),
    ('Tailoring', 'Baju Kurung', 106),
    ('Tailoring', 'Baju Kebaya', 107),
    ('Tailoring', 'Baju Melaya', 108),
    ('Tailoring', 'Lehelga', 109),
    ('Tailoring', 'Alterations', 110),
    ('Tailoring', 'Pavadai Sattai', 111),
    ('Tailoring', 'Designs', 112),
    ('Tailoring', 'Add-ons', 113),
    ('Jewellery & Accessories', 'Earrings', 201),
    ('Jewellery & Accessories', 'Bridal Jewellery Rent', 202),
    ('Jewellery & Accessories', 'Choker Set', 203),
    ('Jewellery & Accessories', 'Anklet', 204),
    ('Jewellery & Accessories', 'Add-ons', 205),
    ('Posstore', 'Claim Parcel', 301),
    ('Posstore', 'Perfume', 302),
    ('Posstore', 'Add-ons', 303)
), resolved AS (
  SELECT c.id AS category_id, c.name_en AS category_name, catalog.product_name, catalog.sort_order
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
  0,
  0,
  0,
  'unit',
  'piece',
  'piece',
  1,
  999,
  999,
  999,
  'piece',
  FALSE,
  '[]'::JSONB,
  resolved.product_name || ' service or product',
  TRUE,
  resolved.sort_order
FROM resolved
WHERE NOT EXISTS (
  SELECT 1
  FROM public.products p
  WHERE p.category_id = resolved.category_id
    AND LOWER(BTRIM(p.name)) = LOWER(BTRIM(resolved.product_name))
);

UPDATE public.products p
SET is_active = TRUE,
    category = c.name_en,
    updated_at = NOW()
FROM public.categories c
WHERE p.category_id = c.id
  AND c.name_en IN ('Tailoring', 'Jewellery & Accessories', 'Posstore');

WITH catalog(category_name, product_name, sort_order) AS (
  VALUES
    ('Tailoring', 'Saree Blouse', 101),
    ('Tailoring', 'Saree Blouse + Cup', 102),
    ('Tailoring', 'Readymade Saree', 103),
    ('Tailoring', 'Punjabi Suit', 104),
    ('Tailoring', 'Punjabi Suit + Salwar', 105),
    ('Tailoring', 'Baju Kurung', 106),
    ('Tailoring', 'Baju Kebaya', 107),
    ('Tailoring', 'Baju Melaya', 108),
    ('Tailoring', 'Lehelga', 109),
    ('Tailoring', 'Alterations', 110),
    ('Tailoring', 'Pavadai Sattai', 111),
    ('Tailoring', 'Designs', 112),
    ('Tailoring', 'Add-ons', 113),
    ('Jewellery & Accessories', 'Earrings', 201),
    ('Jewellery & Accessories', 'Bridal Jewellery Rent', 202),
    ('Jewellery & Accessories', 'Choker Set', 203),
    ('Jewellery & Accessories', 'Anklet', 204),
    ('Jewellery & Accessories', 'Add-ons', 205),
    ('Posstore', 'Claim Parcel', 301),
    ('Posstore', 'Perfume', 302),
    ('Posstore', 'Add-ons', 303)
)
UPDATE public.products p
SET name = catalog.product_name,
    sort_order = catalog.sort_order,
    updated_at = NOW()
FROM catalog
JOIN public.categories c ON LOWER(c.name_en) = LOWER(catalog.category_name)
WHERE p.category_id = c.id
  AND LOWER(BTRIM(p.name)) = LOWER(BTRIM(catalog.product_name));


-- FILE: 20260716_0003_order_rpc_compatibility.sql
-- ═══════════════════════════════════════════════════════════
-- Align the live legacy billing schema with the current RPC payload.
-- Idempotent: safe for both upgraded and freshly migrated projects.

BEGIN;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gst_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS split_details JSONB NOT NULL DEFAULT '{}'::JSONB;

-- Keep one order-item shape that works with both the legacy and current schemas.
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_name TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'catalogue';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS note TEXT;

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq;

-- Prevent collisions when a sequence is introduced after invoices already exist.
DO $$
DECLARE
  v_max_suffix BIGINT;
  v_sequence_value BIGINT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(invoice_no, '-([0-9]+)$'))[1]::BIGINT), 0)
  INTO v_max_suffix
  FROM public.orders
  WHERE invoice_no ~ '-[0-9]+$';

  SELECT last_value INTO v_sequence_value FROM public.invoice_number_seq;
  PERFORM setval(
    'public.invoice_number_seq',
    GREATEST(v_max_suffix, v_sequence_value, 1),
    TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_invoice_no()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
  SELECT 'PB-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
         LPAD(nextval('public.invoice_number_seq')::TEXT, 6, '0');
$$;

CREATE OR REPLACE FUNCTION public.create_order_with_stock(
  p_customer_name TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_items JSONB,
  p_shipping NUMERIC DEFAULT 0,
  p_status TEXT DEFAULT 'pending',
  p_order_mode TEXT DEFAULT 'offline',
  p_order_type TEXT DEFAULT 'pos_sale',
  p_delivery_charge NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_manual_discount_amount NUMERIC DEFAULT 0,
  p_manual_discount_type TEXT DEFAULT 'flat',
  p_manual_discount_value NUMERIC DEFAULT 0,
  p_coupon_code TEXT DEFAULT NULL,
  p_coupon_percentage NUMERIC DEFAULT 0,
  p_total_gst NUMERIC DEFAULT 0,
  p_gst_enabled BOOLEAN DEFAULT FALSE,
  p_payment_method TEXT DEFAULT 'cash',
  p_split_details JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_no TEXT;
  v_order_id UUID;
  v_subtotal NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2);
  v_item JSONB;
  v_quantity NUMERIC(12,3);
  v_price NUMERIC(12,2);
  v_line_total NUMERIC(12,2);
  v_source TEXT;
  v_attempt INTEGER;
  v_uses_typed_item_ids BOOLEAN;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_quantity := GREATEST(COALESCE(NULLIF(v_item ->> 'quantity', '')::NUMERIC, 0), 0);
    v_price := GREATEST(COALESCE(NULLIF(v_item ->> 'base_price', '')::NUMERIC, 0), 0);
    v_line_total := GREATEST(
      COALESCE(NULLIF(v_item ->> 'line_total', '')::NUMERIC, v_quantity * v_price),
      0
    );

    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be greater than zero';
    END IF;

    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  v_total := GREATEST(
    ROUND(
      v_subtotal + GREATEST(COALESCE(p_shipping, 0), 0)
        + GREATEST(COALESCE(p_delivery_charge, 0), 0)
        + GREATEST(COALESCE(p_total_gst, 0), 0)
        - GREATEST(COALESCE(p_discount_amount, 0), 0)
        - GREATEST(COALESCE(p_manual_discount_amount, 0), 0),
      2
    ),
    0
  );

  SELECT data_type = 'bigint'
  INTO v_uses_typed_item_ids
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'product_id';

  FOR v_attempt IN 1..5 LOOP
    v_invoice_no := public.get_next_invoice_no();
    v_order_id := gen_random_uuid();

    BEGIN
      INSERT INTO public.orders (
        id, invoice_no, user_id, customer_name, phone, address, items, subtotal, shipping, total,
        status, order_mode, order_type, delivery_charge, discount_amount, manual_discount_amount,
        manual_discount_type, manual_discount_value, coupon_code, coupon_percentage, total_gst,
        gst_amount, gst_enabled, payment_method, payment_mode, split_details, created_at, updated_at
      ) VALUES (
        v_order_id, v_invoice_no, auth.uid(),
        COALESCE(NULLIF(BTRIM(p_customer_name), ''), 'Walk-in Customer'),
        COALESCE(BTRIM(p_phone), ''), COALESCE(NULLIF(BTRIM(p_address), ''), 'POS Counter'),
        p_items, v_subtotal, GREATEST(COALESCE(p_shipping, 0), 0), v_total,
        COALESCE(NULLIF(BTRIM(p_status), ''), 'pending'),
        COALESCE(NULLIF(BTRIM(p_order_mode), ''), 'offline'),
        COALESCE(NULLIF(BTRIM(p_order_type), ''), 'pos_sale'),
        GREATEST(COALESCE(p_delivery_charge, 0), 0),
        GREATEST(COALESCE(p_discount_amount, 0), 0),
        GREATEST(COALESCE(p_manual_discount_amount, 0), 0),
        COALESCE(NULLIF(BTRIM(p_manual_discount_type), ''), 'flat'),
        GREATEST(COALESCE(p_manual_discount_value, 0), 0),
        NULLIF(BTRIM(COALESCE(p_coupon_code, '')), ''),
        GREATEST(COALESCE(p_coupon_percentage, 0), 0),
        GREATEST(COALESCE(p_total_gst, 0), 0), GREATEST(COALESCE(p_total_gst, 0), 0),
        COALESCE(p_gst_enabled, FALSE),
        COALESCE(NULLIF(BTRIM(p_payment_method), ''), 'cash'),
        COALESCE(NULLIF(BTRIM(p_payment_method), ''), 'cash'),
        COALESCE(p_split_details, '{}'::JSONB), NOW(), NOW()
      );
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_quantity := GREATEST(COALESCE(NULLIF(v_item ->> 'quantity', '')::NUMERIC, 0), 0);
    v_price := GREATEST(COALESCE(NULLIF(v_item ->> 'base_price', '')::NUMERIC, 0), 0);
    v_line_total := GREATEST(
      COALESCE(NULLIF(v_item ->> 'line_total', '')::NUMERIC, v_quantity * v_price),
      0
    );
    v_source := COALESCE(NULLIF(v_item ->> 'source', ''), 'catalogue');

    IF v_uses_typed_item_ids THEN
      INSERT INTO public.order_items (
        order_id, product_id, variant_id, product_name, tamil_name, variant_name,
        quantity, unit, unit_price, line_total, is_manual, source, note
      ) VALUES (
        v_order_id, NULLIF(COALESCE(v_item ->> 'product_id', v_item ->> 'id'), '')::BIGINT,
        NULLIF(v_item ->> 'variant_id', '')::UUID, COALESCE(NULLIF(v_item ->> 'name', ''), 'Product'),
        NULLIF(v_item ->> 'tamil_name', ''), NULLIF(v_item ->> 'variant_name', ''),
        v_quantity, COALESCE(NULLIF(v_item ->> 'unit', ''), 'piece'), v_price, v_line_total,
        v_source = 'manual', v_source, NULLIF(v_item ->> 'note', '')
      );
    ELSE
      INSERT INTO public.order_items (
        order_id, product_id, variant_id, product_name, tamil_name, variant_name,
        quantity, unit, unit_price, line_total, is_manual, source, note
      ) VALUES (
        v_order_id, NULLIF(COALESCE(v_item ->> 'product_id', v_item ->> 'id'), ''),
        NULLIF(v_item ->> 'variant_id', ''), COALESCE(NULLIF(v_item ->> 'name', ''), 'Product'),
        NULLIF(v_item ->> 'tamil_name', ''), NULLIF(v_item ->> 'variant_name', ''),
        v_quantity, COALESCE(NULLIF(v_item ->> 'unit', ''), 'piece'), v_price, v_line_total,
        v_source = 'manual', v_source, NULLIF(v_item ->> 'note', '')
      );
    END IF;

    IF COALESCE(v_item ->> 'product_id', v_item ->> 'id', '') ~ '^[0-9]+$' THEN
      UPDATE public.products
      SET stock_quantity = GREATEST(stock_quantity - v_quantity, 0),
          stock = GREATEST(FLOOR(stock_quantity - v_quantity), 0)::INTEGER,
          updated_at = NOW()
      WHERE id::TEXT = COALESCE(v_item ->> 'product_id', v_item ->> 'id');
    END IF;

    IF NULLIF(v_item ->> 'variant_id', '') IS NOT NULL THEN
      UPDATE public.product_variants
      SET stock = GREATEST(stock - v_quantity, 0), updated_at = NOW()
      WHERE id::TEXT = v_item ->> 'variant_id';
    END IF;
  END LOOP;

  IF NULLIF(BTRIM(COALESCE(p_coupon_code, '')), '') IS NOT NULL THEN
    UPDATE public.coupons
    SET usage_count = usage_count + 1
    WHERE UPPER(BTRIM(code)) = UPPER(BTRIM(p_coupon_code))
      AND is_active
      AND (usage_limit IS NULL OR usage_count < usage_limit);
  END IF;

  RETURN jsonb_build_object(
    'orderId', v_order_id,
    'invoiceNo', v_invoice_no,
    'createdAt', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_with_stock(
  TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC,
  TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC, BOOLEAN, TEXT, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order_with_stock(
  TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC,
  TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC, BOOLEAN, TEXT, JSONB
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;


-- FILE: 20260719_0004_advance_orders.sql
-- ═══════════════════════════════════════════════════════════
begin;

create sequence if not exists public.deposit_number_seq start 1;

alter table public.order_items add column if not exists category text;

create table if not exists public.advance_orders (
  id uuid primary key default gen_random_uuid(),
  deposit_id text not null unique,
  customer_name text not null,
  phone text not null,
  address text not null default '',
  product_name text not null,
  products jsonb not null default '[]'::jsonb,
  category text not null default '',
  description text not null default '',
  total_amount numeric(12,2) not null check (total_amount > 0),
  deposit_amount numeric(12,2) not null check (deposit_amount > 0),
  remaining_balance numeric(12,2) generated always as (total_amount - deposit_amount) stored,
  expected_delivery_date date not null,
  status text not null default 'pending_deposit' check (status in ('pending_deposit','ready_for_delivery','waiting_final_payment','completed','cancelled')),
  remarks text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_order_id uuid unique references public.orders(id),
  invoice_number text unique,
  final_payment_method text,
  constraint advance_deposit_less_than_total check (deposit_amount < total_amount)
);

alter table public.advance_orders add column if not exists products jsonb not null default '[]'::jsonb;

create table if not exists public.advance_order_timeline (
  id bigint generated always as identity primary key,
  advance_order_id uuid not null references public.advance_orders(id) on delete cascade,
  event_type text not null,
  label text not null,
  remarks text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.advance_order_payments (
  id uuid primary key default gen_random_uuid(),
  advance_order_id uuid not null references public.advance_orders(id) on delete cascade,
  payment_type text not null check (payment_type in ('deposit','remaining')),
  amount numeric(12,2) not null check (amount >= 0),
  payment_method text not null check (payment_method in ('cash','upi','card')),
  remarks text not null default '',
  received_by uuid references auth.users(id) on delete set null,
  received_at timestamptz not null default now(),
  unique (advance_order_id, payment_type)
);

create index if not exists advance_orders_created_idx on public.advance_orders(created_at desc);
create index if not exists advance_orders_status_idx on public.advance_orders(status);
create index if not exists advance_orders_delivery_idx on public.advance_orders(expected_delivery_date);
create index if not exists advance_order_timeline_order_idx on public.advance_order_timeline(advance_order_id, created_at);
create index if not exists advance_order_payments_order_idx on public.advance_order_payments(advance_order_id, received_at);

drop function if exists public.create_advance_order(text,text,text,text,text,text,numeric,numeric,date,text,text,text);
create or replace function public.create_advance_order(
  p_customer_name text, p_phone text, p_address text, p_product_name text,
  p_category text, p_description text, p_total_amount numeric, p_deposit_amount numeric,
  p_expected_delivery_date date, p_remarks text, p_payment_method text, p_created_by_name text,
  p_products jsonb default '[]'::jsonb
)
returns public.advance_orders
language plpgsql security definer set search_path = public
as $$
declare v_order public.advance_orders; v_now timestamptz := now(); v_deposit_id text;
begin
  if trim(coalesce(p_customer_name,'')) = '' then raise exception 'Customer name is required'; end if;
  if trim(coalesce(p_phone,'')) = '' then raise exception 'Phone number is required'; end if;
  if trim(coalesce(p_product_name,'')) = '' then raise exception 'Product name is required'; end if;
  if coalesce(p_total_amount,0) <= 0 then raise exception 'Total amount must be greater than zero'; end if;
  if coalesce(p_deposit_amount,0) <= 0 or p_deposit_amount >= p_total_amount then raise exception 'Deposit must be greater than zero and less than the total amount'; end if;
  if lower(coalesce(p_payment_method,'')) not in ('cash','upi','card') then raise exception 'Select a valid deposit payment method'; end if;
  v_deposit_id := 'DEP-' || to_char(v_now at time zone 'Asia/Kolkata','YYYYMMDD') || '-' || lpad(nextval('public.deposit_number_seq')::text,4,'0');
  insert into public.advance_orders(deposit_id,customer_name,phone,address,product_name,products,category,description,total_amount,deposit_amount,expected_delivery_date,remarks,created_by,created_by_name,created_at,updated_at)
  values(v_deposit_id,trim(p_customer_name),trim(p_phone),trim(coalesce(p_address,'')),trim(p_product_name),case when jsonb_typeof(coalesce(p_products,'[]'::jsonb))='array' then coalesce(p_products,'[]'::jsonb) else '[]'::jsonb end,trim(coalesce(p_category,'')),trim(coalesce(p_description,'')),round(p_total_amount,2),round(p_deposit_amount,2),p_expected_delivery_date,trim(coalesce(p_remarks,'')),auth.uid(),trim(coalesce(p_created_by_name,'')),v_now,v_now)
  returning * into v_order;
  insert into public.advance_order_payments(advance_order_id,payment_type,amount,payment_method,remarks,received_by,received_at)
  values(v_order.id,'deposit',v_order.deposit_amount,lower(p_payment_method),coalesce(p_remarks,''),auth.uid(),v_now);
  insert into public.advance_order_timeline(advance_order_id,event_type,label,created_by,created_at) values
    (v_order.id,'created','Created',auth.uid(),v_now),
    (v_order.id,'deposit_received','Deposit Received',auth.uid(),v_now);
  return v_order;
end;
$$;

drop function if exists public.update_advance_order_status(uuid,text,text);
create or replace function public.update_advance_order_status(p_order_id uuid, p_status text, p_remarks text default '')
returns public.advance_orders
language plpgsql security definer set search_path = public
as $$
declare v_order public.advance_orders; v_label text;
begin
  if p_status not in ('pending_deposit','ready_for_delivery','waiting_final_payment','cancelled') then raise exception 'Invalid status transition'; end if;
  select * into v_order from public.advance_orders where id=p_order_id for update;
  if not found then raise exception 'Advance order not found'; end if;
  if v_order.status='completed' then raise exception 'A completed order cannot be changed'; end if;
  v_label := case p_status when 'ready_for_delivery' then 'Tailoring Completed' when 'waiting_final_payment' then 'Customer Contacted' when 'cancelled' then 'Cancelled' else 'Pending Deposit' end;
  update public.advance_orders set status=p_status,remarks=case when trim(coalesce(p_remarks,''))='' then remarks else p_remarks end,updated_at=now() where id=p_order_id returning * into v_order;
  insert into public.advance_order_timeline(advance_order_id,event_type,label,remarks,created_by) values(p_order_id,p_status,v_label,coalesce(p_remarks,''),auth.uid());
  return v_order;
end;
$$;

create or replace function public.add_advance_order_event(p_order_id uuid, p_event_type text, p_label text, p_remarks text default '')
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists(select 1 from public.advance_orders where id=p_order_id) then raise exception 'Advance order not found'; end if;
  insert into public.advance_order_timeline(advance_order_id,event_type,label,remarks,created_by) values(p_order_id,p_event_type,p_label,coalesce(p_remarks,''),auth.uid());
end;
$$;

create or replace function public.complete_advance_order(p_order_id uuid, p_payment_method text, p_remarks text default '')
returns table(order_id uuid, invoice_no text, completed_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare v_advance public.advance_orders; v_order_id uuid := gen_random_uuid(); v_invoice text; v_now timestamptz := now(); v_items jsonb; v_item jsonb;
begin
  if lower(coalesce(p_payment_method,'')) not in ('cash','upi','card') then raise exception 'Select a valid payment method'; end if;
  select * into v_advance from public.advance_orders where id=p_order_id for update;
  if not found then raise exception 'Advance order not found'; end if;
  if v_advance.status='cancelled' then raise exception 'A cancelled order cannot be completed'; end if;
  if v_advance.completed_order_id is not null or v_advance.invoice_number is not null then raise exception 'Invoice already generated for this order'; end if;
  v_invoice := 'PB-' || to_char(v_now at time zone 'Asia/Kolkata','YYYYMMDD') || '-' || lpad(nextval('public.invoice_number_seq')::text,6,'0');
  v_items := case when jsonb_typeof(v_advance.products)='array' and jsonb_array_length(v_advance.products)>0 then v_advance.products else jsonb_build_array(jsonb_build_object('name',v_advance.product_name,'category',v_advance.category,'description',v_advance.description,'quantity',1,'base_price',v_advance.total_amount,'line_total',v_advance.total_amount,'unit','piece','unit_type','unit','source','advance_order')) end;
  insert into public.orders(id,invoice_no,customer_name,phone,address,user_id,items,subtotal,total,status,order_mode,order_type,shipping,delivery_charge,discount_amount,manual_discount_amount,payment_mode,payment_method,created_at,updated_at)
  values(v_order_id,v_invoice,v_advance.customer_name,v_advance.phone,v_advance.address,auth.uid(),v_items,v_advance.total_amount,v_advance.total_amount,'completed','offline','advance_order',0,0,0,0,lower(p_payment_method),lower(p_payment_method),v_now,v_now);
  for v_item in select value from jsonb_array_elements(v_items) loop
    insert into public.order_items(order_id,product_name,category,quantity,unit,unit_price,line_total,is_manual,source,note)
    values(v_order_id,coalesce(nullif(v_item->>'name',''),'Product'),coalesce(nullif(v_item->>'category',''),v_advance.category),greatest(coalesce(nullif(v_item->>'quantity','')::numeric,1),0),coalesce(nullif(v_item->>'unit',''),'piece'),greatest(coalesce(nullif(v_item->>'base_price','')::numeric,0),0),greatest(coalesce(nullif(v_item->>'line_total','')::numeric,0),0),false,'advance_order',coalesce(nullif(v_item->>'note',''),v_advance.description));
  end loop;
  insert into public.advance_order_payments(advance_order_id,payment_type,amount,payment_method,remarks,received_by,received_at)
  values(p_order_id,'remaining',v_advance.remaining_balance,lower(p_payment_method),coalesce(p_remarks,''),auth.uid(),v_now);
  update public.advance_orders set status='completed',completed_at=v_now,completed_order_id=v_order_id,invoice_number=v_invoice,final_payment_method=lower(p_payment_method),remarks=case when trim(coalesce(p_remarks,''))='' then remarks else p_remarks end,updated_at=v_now where id=p_order_id;
  insert into public.advance_order_timeline(advance_order_id,event_type,label,remarks,created_by,created_at) values
    (p_order_id,'remaining_payment_received','Remaining Payment Received',coalesce(p_remarks,''),auth.uid(),v_now),
    (p_order_id,'invoice_generated','Invoice Generated',v_invoice,auth.uid(),v_now);
  return query select v_order_id,v_invoice,v_now;
end;
$$;

alter table public.advance_orders enable row level security;
alter table public.advance_order_timeline enable row level security;
alter table public.advance_order_payments enable row level security;

drop policy if exists "Allow all for advance orders" on public.advance_orders;
create policy "Allow all for advance orders" on public.advance_orders for all using (true) with check (true);

drop policy if exists "Allow all for advance timeline" on public.advance_order_timeline;
create policy "Allow all for advance timeline" on public.advance_order_timeline for all using (true) with check (true);

drop policy if exists "Allow all for advance payments" on public.advance_order_payments;
create policy "Allow all for advance payments" on public.advance_order_payments for all using (true) with check (true);

grant usage, select on sequence public.deposit_number_seq to public, anon, authenticated;
grant usage, select on sequence public.invoice_number_seq to public, anon, authenticated;

grant select, insert, update, delete on public.advance_orders to public, anon, authenticated;
grant select, insert, update, delete on public.advance_order_timeline to public, anon, authenticated;
grant select, insert, update, delete on public.advance_order_payments to public, anon, authenticated;

grant execute on function public.create_advance_order(text,text,text,text,text,text,numeric,numeric,date,text,text,text,jsonb) to public, anon, authenticated;
grant execute on function public.update_advance_order_status(uuid,text,text) to public, anon, authenticated;
grant execute on function public.add_advance_order_event(uuid,text,text,text) to public, anon, authenticated;
grant execute on function public.complete_advance_order(uuid,text,text) to public, anon, authenticated;

notify pgrst, 'reload schema';
commit;



-- FILE: 20260722_0005_eight_digit_invoice_numbers.sql
-- ═══════════════════════════════════════════════════════════
-- Migration: 8-digit Invoice Number Generation
-- Ensures invoice numbers are strictly 8 digits in total (e.g., 10000001, 10000002...)

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START WITH 10000001;

CREATE OR REPLACE FUNCTION public.get_next_invoice_no()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
  SELECT LPAD(nextval('public.invoice_number_seq')::TEXT, 8, '0');
$$;


-- FILE: 20260724_0006_fix_complete_advance_order.sql
-- ═══════════════════════════════════════════════════════════
-- Migration: Fix complete_advance_order RPC
-- The previous version referenced columns (unit_price, source, note) that do
-- not exist in the order_items table. This patch corrects the insert to use
-- the actual column names: base_price, line_total, is_manual.

CREATE OR REPLACE FUNCTION public.complete_advance_order(
  p_order_id uuid,
  p_payment_method text,
  p_remarks text DEFAULT ''
)
RETURNS TABLE(order_id uuid, invoice_no text, completed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance        public.advance_orders;
  v_order_id       uuid := gen_random_uuid();
  v_invoice        text;
  v_now            timestamptz := now();
  v_items          jsonb;
  v_item           jsonb;
BEGIN
  -- Validate payment method
  IF lower(coalesce(p_payment_method, '')) NOT IN ('cash', 'upi', 'card') THEN
    RAISE EXCEPTION 'Select a valid payment method';
  END IF;

  -- Lock and fetch the advance order
  SELECT * INTO v_advance FROM public.advance_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Advance order not found';
  END IF;
  IF v_advance.status = 'cancelled' THEN
    RAISE EXCEPTION 'A cancelled order cannot be completed';
  END IF;
  IF v_advance.completed_order_id IS NOT NULL OR v_advance.invoice_number IS NOT NULL THEN
    RAISE EXCEPTION 'Invoice already generated for this order';
  END IF;

  -- Generate invoice number using the existing 8-digit sequence
  v_invoice := LPAD(nextval('public.invoice_number_seq')::TEXT, 8, '0');

  -- Build items JSONB — prefer products array, fall back to single product
  v_items := CASE
    WHEN jsonb_typeof(v_advance.products) = 'array' AND jsonb_array_length(v_advance.products) > 0
      THEN v_advance.products
    ELSE jsonb_build_array(
      jsonb_build_object(
        'name',        v_advance.product_name,
        'category',    v_advance.category,
        'description', v_advance.description,
        'quantity',    1,
        'base_price',  v_advance.total_amount,
        'line_total',  v_advance.total_amount,
        'unit',        'piece',
        'unit_type',   'unit',
        'source',      'advance_order'
      )
    )
  END;

  -- Create the final sale order
  INSERT INTO public.orders (
    id, invoice_no, customer_name, phone, address, user_id,
    items, subtotal, total, status, order_mode, order_type,
    shipping, delivery_charge, discount_amount, manual_discount_amount,
    payment_mode, payment_method, created_at, updated_at
  ) VALUES (
    v_order_id, v_invoice,
    v_advance.customer_name, v_advance.phone, v_advance.address, auth.uid(),
    v_items, v_advance.total_amount, v_advance.total_amount,
    'completed', 'offline', 'advance_order',
    0, 0, 0, 0,
    lower(p_payment_method), lower(p_payment_method),
    v_now, v_now
  );

  -- Insert order_items using the CORRECT column names from the schema
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
    INSERT INTO public.order_items (
      order_id, product_name, name, quantity, unit, unit_type,
      base_price, line_total, is_manual
    ) VALUES (
      v_order_id,
      coalesce(nullif(trim(v_item->>'name'), ''), 'Product'),
      coalesce(nullif(trim(v_item->>'name'), ''), 'Product'),
      greatest(coalesce((v_item->>'quantity')::numeric, 1), 0),
      coalesce(nullif(v_item->>'unit', ''), 'piece'),
      coalesce(nullif(v_item->>'unit_type', ''), 'unit'),
      greatest(coalesce((v_item->>'base_price')::numeric, 0), 0),
      greatest(coalesce((v_item->>'line_total')::numeric, 0), 0),
      false
    );
  END LOOP;

  -- Record the final payment received
  INSERT INTO public.advance_order_payments (
    advance_order_id, payment_type, amount, payment_method, remarks, received_by, received_at
  ) VALUES (
    p_order_id, 'remaining', v_advance.remaining_balance,
    lower(p_payment_method), coalesce(p_remarks, ''), auth.uid(), v_now
  );

  -- Mark advance order as completed
  UPDATE public.advance_orders SET
    status               = 'completed',
    completed_at         = v_now,
    completed_order_id   = v_order_id,
    invoice_number       = v_invoice,
    final_payment_method = lower(p_payment_method),
    remarks              = CASE WHEN trim(coalesce(p_remarks, '')) = '' THEN remarks ELSE p_remarks END,
    updated_at           = v_now
  WHERE id = p_order_id;

  -- Timeline events
  INSERT INTO public.advance_order_timeline (
    advance_order_id, event_type, label, remarks, created_by, created_at
  ) VALUES
    (p_order_id, 'remaining_payment_received', 'Remaining Payment Received', coalesce(p_remarks, ''), auth.uid(), v_now),
    (p_order_id, 'invoice_generated',          'Invoice Generated',          v_invoice,               auth.uid(), v_now);

  RETURN QUERY SELECT v_order_id, v_invoice, v_now;
END;
$$;

-- Re-grant execute permission
GRANT EXECUTE ON FUNCTION public.complete_advance_order(uuid, text, text)
  TO public, anon, authenticated;

NOTIFY pgrst, 'reload schema';


-- FILE: 20260724_0008_fix_public_invoice_rpc.sql
-- ═══════════════════════════════════════════════════════════
-- Migration: Fix missing get_public_invoice_by_number RPC
-- Re-creates the function and forces a schema cache reload to resolve 404 errors on the /invoice page

CREATE OR REPLACE FUNCTION public.get_public_invoice_by_number(p_invoice_no TEXT)
RETURNS SETOF public.orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.orders WHERE invoice_no = NULLIF(BTRIM(p_invoice_no), '') LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_invoice_by_number(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_by_number(TEXT) TO anon, authenticated;

-- Force PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';


-- FILE: 20260724_0009_create_invoices_bucket.sql
-- ═══════════════════════════════════════════════════════════
-- Migration: Create invoices storage bucket
-- Creates the 'invoices' bucket and sets up public read access and upload policies

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoices', 'invoices', TRUE, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = TRUE, file_size_limit = 10485760, allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS invoices_public_read ON storage.objects;
CREATE POLICY invoices_public_read ON storage.objects FOR SELECT TO public USING (bucket_id = 'invoices');

DROP POLICY IF EXISTS invoices_portal_upload ON storage.objects;
CREATE POLICY invoices_portal_upload ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'invoices');

DROP POLICY IF EXISTS invoices_portal_update ON storage.objects;
CREATE POLICY invoices_portal_update ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'invoices') WITH CHECK (bucket_id = 'invoices');


-- FILE: 20260726_0007_update_complete_advance_order_discount.sql
-- ═══════════════════════════════════════════════════════════
-- Migration: Update complete_advance_order to handle final amount, discounts, and coupons
-- This creates a new version of the RPC (v2) which is called from the frontend.

CREATE OR REPLACE FUNCTION public.complete_advance_order_v2(
  p_order_id uuid,
  p_payment_method text,
  p_final_amount numeric,
  p_coupon_code text DEFAULT NULL,
  p_coupon_percentage numeric DEFAULT 0,
  p_manual_discount numeric DEFAULT 0,
  p_remarks text DEFAULT ''
)
RETURNS TABLE(order_id uuid, invoice_no text, completed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance        public.advance_orders;
  v_order_id       uuid := gen_random_uuid();
  v_invoice        text;
  v_now            timestamptz := now();
  v_items          jsonb;
  v_item           jsonb;
  v_total_discount numeric := 0;
BEGIN
  -- Validate payment method
  IF lower(coalesce(p_payment_method, '')) NOT IN ('cash', 'upi', 'card') THEN
    RAISE EXCEPTION 'Select a valid payment method';
  END IF;

  -- Lock and fetch the advance order
  SELECT * INTO v_advance FROM public.advance_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Advance order not found';
  END IF;
  IF v_advance.status = 'cancelled' THEN
    RAISE EXCEPTION 'A cancelled order cannot be completed';
  END IF;
  IF v_advance.completed_order_id IS NOT NULL OR v_advance.invoice_number IS NOT NULL THEN
    RAISE EXCEPTION 'Invoice already generated for this order';
  END IF;

  -- Calculate the total discount from manual discount and coupon
  v_total_discount := p_manual_discount + (v_advance.remaining_balance - p_manual_discount - p_final_amount);
  IF v_total_discount < 0 THEN
    v_total_discount := 0;
  END IF;

  -- Generate invoice number using the existing 8-digit sequence
  v_invoice := LPAD(nextval('public.invoice_number_seq')::TEXT, 8, '0');

  -- Build items JSONB - prefer products array, fall back to single product
  v_items := CASE
    WHEN jsonb_typeof(v_advance.products) = 'array' AND jsonb_array_length(v_advance.products) > 0
      THEN v_advance.products
    ELSE jsonb_build_array(
      jsonb_build_object(
        'name',        v_advance.product_name,
        'category',    v_advance.category,
        'description', v_advance.description,
        'quantity',    1,
        'base_price',  v_advance.total_amount,
        'line_total',  v_advance.total_amount,
        'unit',        'piece',
        'unit_type',   'unit',
        'source',      'advance_order'
      )
    )
  END;

  -- Create the final sale order, storing the discount information
  INSERT INTO public.orders (
    id, invoice_no, customer_name, phone, address, user_id,
    items, subtotal, total, status, order_mode, order_type,
    shipping, delivery_charge, discount_amount, manual_discount_amount,
    coupon_code, coupon_percentage, manual_discount_type, manual_discount_value,
    payment_mode, payment_method, created_at, updated_at
  ) VALUES (
    v_order_id, v_invoice,
    v_advance.customer_name, v_advance.phone, v_advance.address, auth.uid(),
    v_items, v_advance.total_amount, greatest(0, v_advance.total_amount - v_total_discount),
    'completed', 'offline', 'advance_order',
    0, 0, v_total_discount, p_manual_discount,
    p_coupon_code, p_coupon_percentage, 'flat', p_manual_discount,
    lower(p_payment_method), lower(p_payment_method),
    v_now, v_now
  );

  -- Insert order_items using the CORRECT column names from the schema
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
    INSERT INTO public.order_items (
      order_id, product_name, name, quantity, unit, unit_type,
      base_price, line_total, is_manual
    ) VALUES (
      v_order_id,
      coalesce(nullif(trim(v_item->>'name'), ''), 'Product'),
      coalesce(nullif(trim(v_item->>'name'), ''), 'Product'),
      greatest(coalesce((v_item->>'quantity')::numeric, 1), 0),
      coalesce(nullif(v_item->>'unit', ''), 'piece'),
      coalesce(nullif(v_item->>'unit_type', ''), 'unit'),
      greatest(coalesce((v_item->>'base_price')::numeric, 0), 0),
      greatest(coalesce((v_item->>'line_total')::numeric, 0), 0),
      false
    );
  END LOOP;

  -- Record the final payment received
  INSERT INTO public.advance_order_payments (
    advance_order_id, payment_type, amount, payment_method, remarks, received_by, received_at
  ) VALUES (
    p_order_id, 'remaining', p_final_amount,
    lower(p_payment_method), coalesce(p_remarks, ''), auth.uid(), v_now
  );

  -- Mark advance order as completed. Note that remaining_balance is GENERATED ALWAYS AS (total_amount - deposit_amount)
  -- so we do not update remaining_balance directly, but the UI considers it "paid".
  UPDATE public.advance_orders SET
    status               = 'completed',
    completed_at         = v_now,
    completed_order_id   = v_order_id,
    invoice_number       = v_invoice,
    final_payment_method = lower(p_payment_method),
    remarks              = CASE WHEN trim(coalesce(p_remarks, '')) = '' THEN remarks ELSE p_remarks END,
    updated_at           = v_now
  WHERE id = p_order_id;

  -- Timeline events
  INSERT INTO public.advance_order_timeline (
    advance_order_id, event_type, label, remarks, created_by, created_at
  ) VALUES
    (p_order_id, 'remaining_payment_received', 'Remaining Payment Received', coalesce(p_remarks, ''), auth.uid(), v_now),
    (p_order_id, 'invoice_generated',          'Invoice Generated',          v_invoice,               auth.uid(), v_now);

  RETURN QUERY SELECT v_order_id, v_invoice, v_now;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.complete_advance_order_v2(uuid, text, numeric, text, numeric, numeric, text)
  TO public, anon, authenticated;

NOTIFY pgrst, 'reload schema';


-- FILE: 20260728_0010_final_audit_fixes.sql
-- ═══════════════════════════════════════════════════════════
-- ============================================================
-- Migration 0010: Final audit fixes
-- Date: 2026-07-28
-- Purpose: Fix all remaining production issues found in audit
-- ============================================================

-- 1. Create store_reviews table (used by Home.tsx but never created in any migration)
CREATE TABLE IF NOT EXISTS public.store_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    text,
  reviewer    text,
  rating      integer CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert reviews" ON public.store_reviews;
CREATE POLICY "Anyone can insert reviews" ON public.store_reviews FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.store_reviews;
CREATE POLICY "Anyone can read reviews"  ON public.store_reviews FOR SELECT USING (true);

-- 2. Make completed_order_id FK in advance_orders ON DELETE SET NULL
--    so that deleting an order from the orders table does not require
--    manually clearing advance_orders.completed_order_id first.
--    (Our frontend now also clears it first, but this is the proper DB-level safety net)
ALTER TABLE public.advance_orders
  DROP CONSTRAINT IF EXISTS advance_orders_completed_order_id_fkey;

ALTER TABLE public.advance_orders
  ADD CONSTRAINT advance_orders_completed_order_id_fkey
  FOREIGN KEY (completed_order_id)
  REFERENCES public.orders(id)
  ON DELETE SET NULL;

-- 3. Ensure invoice_no column in advance_orders stores the INV-prefixed number
--    (already works via complete_advance_order_v2, but add index for faster lookup)
CREATE INDEX IF NOT EXISTS idx_advance_orders_invoice_number ON public.advance_orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_advance_orders_status ON public.advance_orders(status);
CREATE INDEX IF NOT EXISTS idx_advance_orders_created_at ON public.advance_orders(created_at DESC);

-- 4. Ensure orders table has index on invoice_no for fast public invoice lookups
CREATE INDEX IF NOT EXISTS idx_orders_invoice_no ON public.orders(invoice_no);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- 5. Ensure update_advance_order_status RPC is up to date and handles all statuses
DROP FUNCTION IF EXISTS public.update_advance_order_status(uuid, text, text);
CREATE OR REPLACE FUNCTION public.update_advance_order_status(
  p_order_id uuid,
  p_status   text,
  p_remarks  text DEFAULT ''
)
RETURNS SETOF public.advance_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.advance_orders;
BEGIN
  SELECT * INTO v_order FROM public.advance_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Advance order % not found', p_order_id;
  END IF;

  UPDATE public.advance_orders SET
    status     = p_status,
    remarks    = CASE WHEN trim(coalesce(p_remarks,'')) = '' THEN remarks ELSE p_remarks END,
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.advance_order_timeline (advance_order_id, event_type, label, remarks, created_by, created_at)
  VALUES (
    p_order_id,
    p_status,
    CASE p_status
      WHEN 'pending_deposit'      THEN 'Status: Pending Deposit'
      WHEN 'waiting_final_payment' THEN 'Status: Waiting for Final Payment'
      WHEN 'ready_for_delivery'   THEN 'Status: Ready to Collect'
      WHEN 'completed'            THEN 'Order Completed'
      WHEN 'cancelled'            THEN 'Order Cancelled'
      ELSE p_status
    END,
    coalesce(p_remarks, ''),
    auth.uid(),
    now()
  );

  RETURN QUERY SELECT * FROM public.advance_orders WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_advance_order_status(uuid, text, text) TO authenticated, anon, public;

-- 6. Ensure add_advance_order_event RPC is robust
CREATE OR REPLACE FUNCTION public.add_advance_order_event(
  p_order_id   uuid,
  p_event_type text,
  p_label      text,
  p_remarks    text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.advance_order_timeline (advance_order_id, event_type, label, remarks, created_by, created_at)
  VALUES (p_order_id, p_event_type, p_label, coalesce(p_remarks,''), auth.uid(), now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_advance_order_event(uuid, text, text, text) TO authenticated, anon, public;

-- 7. Ensure profiles RLS allows staff to update their own profile (avatar etc)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 8. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';


-- FILE: 20260808_0011_billing_date_and_order_fields.sql
-- ═══════════════════════════════════════════════════════════
-- ============================================================
-- Migration 0011: Add billing_date and ensure order metadata columns exist
-- Date: 2026-08-08
-- Purpose:
--   1. Add optional billing_date column to orders table so admins
--      can backdate or set a custom billing date/time per sale.
--   2. Ensure remarks and reference_number columns exist (they were
--      added via the dashboard and used in existing client code).
-- ============================================================

BEGIN;

-- Ensure remarks column exists (used by Pos.tsx update call)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS remarks TEXT NOT NULL DEFAULT '';

-- Ensure reference_number column exists (used by Pos.tsx update call)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reference_number TEXT NOT NULL DEFAULT '';

-- Add optional billing_date column.
-- When NULL the UI falls back to created_at for display.
-- When set, it represents the admin-chosen billing date/time.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS billing_date TIMESTAMPTZ;

-- Index for fast lookup by billing_date in analytics
CREATE INDEX IF NOT EXISTS idx_orders_billing_date ON public.orders(billing_date);

-- Reload PostgREST schema cache so the new column is immediately accessible
NOTIFY pgrst, 'reload schema';

COMMIT;


-- FILE: 20260822_0001_new_modules.sql
-- ═══════════════════════════════════════════════════════════
-- ==========================================
-- 1. INVENTORY ENHANCEMENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id BIGINT REFERENCES public.products(id) ON DELETE CASCADE,
    old_quantity NUMERIC(12,3) NOT NULL,
    new_quantity NUMERIC(12,3) NOT NULL,
    adjustment NUMERIC(12,3) NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('sale', 'restock', 'return', 'manual_adjustment', 'loss')),
    reference_id TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger function to automatically deduct stock and log it on order completion
CREATE OR REPLACE FUNCTION public.handle_order_inventory_deduction()
RETURNS TRIGGER AS $function$
DECLARE
    item RECORD;
    current_stock NUMERIC(12,3);
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        FOR item IN SELECT * FROM public.order_items WHERE order_id = NEW.id LOOP
            -- Get current stock
            SELECT stock_quantity INTO current_stock FROM public.products WHERE id = item.product_id;
            
            IF current_stock IS NOT NULL THEN
                -- Update product stock
                UPDATE public.products 
                SET stock_quantity = stock_quantity - item.quantity,
                    updated_at = NOW()
                WHERE id = item.product_id;
                
                -- Insert log
                INSERT INTO public.inventory_logs (product_id, old_quantity, new_quantity, adjustment, reason, reference_id)
                VALUES (
                    item.product_id, 
                    current_stock, 
                    current_stock - item.quantity, 
                    -item.quantity, 
                    'sale', 
                    NEW.id::text
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_order_inventory_deduction ON public.orders;
CREATE TRIGGER trigger_order_inventory_deduction
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_order_inventory_deduction();

-- Also handle advance order completion (tailoring/custom) if they contain product items.
-- NOTE: this previously checked NEW.status = 'delivered' and read NEW.items — neither
-- exists on this table ('delivered' isn't in the status CHECK constraint, and the
-- JSONB column is named 'products', not 'items'), so it silently never ran. The real
-- terminal status the app sets (via complete_advance_order_v2) is 'completed'.
CREATE OR REPLACE FUNCTION public.handle_advance_order_inventory_deduction()
RETURNS TRIGGER AS $function$
DECLARE
    item RECORD;
    current_stock NUMERIC(12,3);
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        FOR item IN
            SELECT (jsonb_array_elements(NEW.products)->>'product_id')::BIGINT AS product_id,
                   (jsonb_array_elements(NEW.products)->>'quantity')::NUMERIC AS quantity
            WHERE (jsonb_array_elements(NEW.products)->>'product_id') IS NOT NULL
        LOOP
            SELECT stock_quantity INTO current_stock FROM public.products WHERE id = item.product_id;

            IF current_stock IS NOT NULL THEN
                UPDATE public.products
                SET stock_quantity = GREATEST(stock_quantity - item.quantity, 0),
                    stock = GREATEST(FLOOR(stock_quantity - item.quantity), 0)::INTEGER,
                    updated_at = NOW()
                WHERE id = item.product_id;

                INSERT INTO public.inventory_logs (product_id, old_quantity, new_quantity, adjustment, reason, reference_id)
                VALUES (
                    item.product_id,
                    current_stock,
                    GREATEST(current_stock - item.quantity, 0),
                    -item.quantity,
                    'sale',
                    NEW.id::text
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_advance_order_inventory_deduction ON public.advance_orders;
CREATE TRIGGER trigger_advance_order_inventory_deduction
    AFTER UPDATE OF status ON public.advance_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_advance_order_inventory_deduction();


-- ==========================================
-- 2. EXPENSES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed basic categories
INSERT INTO public.expense_categories (name) VALUES 
('Rent'), ('Utilities'), ('Salaries'), ('Supplies'), ('Marketing'), ('Maintenance'), ('Other')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id INTEGER REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    receipt_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 3. ATTENDANCE & STAFF
-- ==========================================
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Staff',
    phone TEXT,
    base_salary NUMERIC(12,2) DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'half-day', 'leave')),
    check_in_time TIMESTAMPTZ,
    notes TEXT,
    marked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (staff_id, date) -- One attendance record per staff per day
);

-- ==========================================
-- STORAGE & RLS POLICIES
-- ==========================================
-- Assuming 'receipts' bucket needs to be created (Supabase storage.buckets)
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage (Allow authenticated users to upload/read)
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Authenticated users can read receipts" ON storage.objects;
CREATE POLICY "Authenticated users can read receipts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'receipts');

-- Enable RLS on new tables
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users full access for now (matching existing tables pattern)
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.inventory_logs;
CREATE POLICY "Enable read access for all authenticated users" ON public.inventory_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable insert access for all authenticated users" ON public.inventory_logs;
CREATE POLICY "Enable insert access for all authenticated users" ON public.inventory_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.expense_categories;
CREATE POLICY "Enable read access for all authenticated users" ON public.expense_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable all access for all authenticated users" ON public.expense_categories;
CREATE POLICY "Enable all access for all authenticated users" ON public.expense_categories FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable all access for all authenticated users" ON public.expenses;
CREATE POLICY "Enable all access for all authenticated users" ON public.expenses FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable all access for all authenticated users" ON public.staff;
CREATE POLICY "Enable all access for all authenticated users" ON public.staff FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable all access for all authenticated users" ON public.attendance;
CREATE POLICY "Enable all access for all authenticated users" ON public.attendance FOR ALL TO authenticated USING (true);


-- FILE: 20260904_0001_tailoring_catalog_retired.sql
-- ═══════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════
-- EXTRA FIXES — not covered by any numbered migration above.
-- Sourced from loose .sql files in supabase/ (add_missing_order_columns.sql,
-- fix_policies.sql, migration_payment_methods.sql), corrected:
--   - add_missing_order_columns.sql had a stray typo after its semicolon
--   - migration_payment_methods.sql used broken dollar-quoting ($function
--     instead of $function$), which would fail to run as-is
--   - only the RPC versions actually called by the frontend are redefined
--     here (create_advance_order, complete_advance_order_v2); the unused
--     v1/v3 variants from the loose file are dropped as dead code
-- ═══════════════════════════════════════════════════════════

-- 1. Missing order column (remarks/reference_number/billing_date are
-- already added by migration 0011 above; invoice_pdf_url was missing).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT;

-- 1b. Missing product column — src/services/productService.ts selects
-- item_type on every product fetch (and the Inventory "Product / Service"
-- toggle writes it), but no migration ever created it. Without this the
-- entire product SELECT fails at the PostgREST level ("column
-- products.item_type does not exist"), which is what breaks the whole
-- catalog/POS/product list — not an RLS or connectivity problem.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'product';
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_item_type_check;
ALTER TABLE public.products ADD CONSTRAINT products_item_type_check CHECK (item_type IN ('product', 'service'));

-- 2. The UI's real payment method list (src/lib/paymentMethods.ts) includes
-- Credit Card, Debit Card, QR Payment, e-Wallet, Ali Pay, WeChat Pay,
-- Shopee Pay, Others — none of which match the table's original
-- ('cash','upi','card') whitelist. Drop it so any method the UI offers
-- can actually be saved.
ALTER TABLE public.advance_order_payments
  DROP CONSTRAINT IF EXISTS advance_order_payments_payment_method_check;

-- 3. Re-create create_advance_order without the same hardcoded whitelist
-- check (was: payment_method not in ('cash','upi','card') -> exception).
CREATE OR REPLACE FUNCTION public.create_advance_order(
  p_customer_name text, p_phone text, p_address text, p_product_name text,
  p_category text, p_description text, p_total_amount numeric, p_deposit_amount numeric,
  p_expected_delivery_date date, p_remarks text, p_payment_method text, p_created_by_name text,
  p_products jsonb default '[]'::jsonb
)
RETURNS public.advance_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_order public.advance_orders; v_now timestamptz := now(); v_deposit_id text;
BEGIN
  IF trim(coalesce(p_customer_name,'')) = '' THEN RAISE EXCEPTION 'Customer name is required'; END IF;
  IF trim(coalesce(p_phone,'')) = '' THEN RAISE EXCEPTION 'Phone number is required'; END IF;
  IF trim(coalesce(p_product_name,'')) = '' THEN RAISE EXCEPTION 'Product name is required'; END IF;
  IF coalesce(p_total_amount,0) <= 0 THEN RAISE EXCEPTION 'Total amount must be greater than zero'; END IF;
  IF coalesce(p_deposit_amount,0) <= 0 OR p_deposit_amount >= p_total_amount THEN RAISE EXCEPTION 'Deposit must be greater than zero and less than the total amount'; END IF;
  v_deposit_id := 'DEP-' || to_char(v_now AT TIME ZONE 'Asia/Kolkata','YYYYMMDD') || '-' || lpad(nextval('public.deposit_number_seq')::text,4,'0');
  INSERT INTO public.advance_orders(deposit_id,customer_name,phone,address,product_name,products,category,description,total_amount,deposit_amount,expected_delivery_date,remarks,created_by,created_by_name,created_at,updated_at)
  VALUES(v_deposit_id,trim(p_customer_name),trim(p_phone),trim(coalesce(p_address,'')),trim(p_product_name),CASE WHEN jsonb_typeof(coalesce(p_products,'[]'::jsonb))='array' THEN coalesce(p_products,'[]'::jsonb) ELSE '[]'::jsonb END,trim(coalesce(p_category,'')),trim(coalesce(p_description,'')),round(p_total_amount,2),round(p_deposit_amount,2),p_expected_delivery_date,trim(coalesce(p_remarks,'')),auth.uid(),trim(coalesce(p_created_by_name,'')),v_now,v_now)
  RETURNING * INTO v_order;
  INSERT INTO public.advance_order_payments(advance_order_id,payment_type,amount,payment_method,remarks,received_by,received_at)
  VALUES(v_order.id,'deposit',v_order.deposit_amount,lower(p_payment_method),coalesce(p_remarks,''),auth.uid(),v_now);
  INSERT INTO public.advance_order_timeline(advance_order_id,event_type,label,created_by,created_at) VALUES
    (v_order.id,'created','Created',auth.uid(),v_now),
    (v_order.id,'deposit_received','Deposit Received',auth.uid(),v_now);
  RETURN v_order;
END;
$$;

-- 4. Re-create complete_advance_order_v2 (the version actually called by
-- src/services/advanceOrderService.ts) without the same whitelist check.
CREATE OR REPLACE FUNCTION public.complete_advance_order_v2(
  p_order_id uuid,
  p_payment_method text,
  p_final_amount numeric,
  p_coupon_code text DEFAULT NULL,
  p_coupon_percentage numeric DEFAULT 0,
  p_manual_discount numeric DEFAULT 0,
  p_remarks text DEFAULT ''
)
RETURNS TABLE(order_id uuid, invoice_no text, completed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance        public.advance_orders;
  v_order_id       uuid := gen_random_uuid();
  v_invoice        text;
  v_now            timestamptz := now();
  v_items          jsonb;
  v_item           jsonb;
  v_total_discount numeric := 0;
BEGIN
  SELECT * INTO v_advance FROM public.advance_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Advance order not found';
  END IF;
  IF v_advance.status = 'cancelled' THEN
    RAISE EXCEPTION 'A cancelled order cannot be completed';
  END IF;
  IF v_advance.completed_order_id IS NOT NULL OR v_advance.invoice_number IS NOT NULL THEN
    RAISE EXCEPTION 'Invoice already generated for this order';
  END IF;

  v_total_discount := p_manual_discount + (v_advance.remaining_balance - p_manual_discount - p_final_amount);
  IF v_total_discount < 0 THEN
    v_total_discount := 0;
  END IF;

  v_invoice := LPAD(nextval('public.invoice_number_seq')::TEXT, 8, '0');

  v_items := CASE
    WHEN jsonb_typeof(v_advance.products) = 'array' AND jsonb_array_length(v_advance.products) > 0
      THEN v_advance.products
    ELSE jsonb_build_array(
      jsonb_build_object(
        'name',        v_advance.product_name,
        'category',    v_advance.category,
        'description', v_advance.description,
        'quantity',    1,
        'base_price',  v_advance.total_amount,
        'line_total',  v_advance.total_amount,
        'unit',        'piece',
        'unit_type',   'unit',
        'source',      'advance_order'
      )
    )
  END;

  INSERT INTO public.orders (
    id, invoice_no, customer_name, phone, address, user_id,
    items, subtotal, total, status, order_mode, order_type,
    shipping, delivery_charge, discount_amount, manual_discount_amount,
    coupon_code, coupon_percentage, manual_discount_type, manual_discount_value,
    payment_mode, payment_method, created_at, updated_at
  ) VALUES (
    v_order_id, v_invoice,
    v_advance.customer_name, v_advance.phone, v_advance.address, auth.uid(),
    v_items, v_advance.total_amount, greatest(0, v_advance.total_amount - v_total_discount),
    'completed', 'offline', 'advance_order',
    0, 0, v_total_discount, p_manual_discount,
    p_coupon_code, p_coupon_percentage, 'flat', p_manual_discount,
    lower(p_payment_method), lower(p_payment_method),
    v_now, v_now
  );

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
    INSERT INTO public.order_items (
      order_id, product_name, name, quantity, unit, unit_type,
      base_price, line_total, is_manual
    ) VALUES (
      v_order_id,
      coalesce(nullif(trim(v_item->>'name'), ''), 'Product'),
      coalesce(nullif(trim(v_item->>'name'), ''), 'Product'),
      greatest(coalesce((v_item->>'quantity')::numeric, 1), 0),
      coalesce(nullif(v_item->>'unit', ''), 'piece'),
      coalesce(nullif(v_item->>'unit_type', ''), 'unit'),
      greatest(coalesce((v_item->>'base_price')::numeric, 0), 0),
      greatest(coalesce((v_item->>'line_total')::numeric, 0), 0),
      false
    );
  END LOOP;

  INSERT INTO public.advance_order_payments (
    advance_order_id, payment_type, amount, payment_method, remarks, received_by, received_at
  ) VALUES (
    p_order_id, 'remaining', p_final_amount,
    lower(p_payment_method), coalesce(p_remarks, ''), auth.uid(), v_now
  );

  UPDATE public.advance_orders SET
    status               = 'completed',
    completed_at         = v_now,
    completed_order_id   = v_order_id,
    invoice_number       = v_invoice,
    final_payment_method = lower(p_payment_method),
    remarks              = CASE WHEN trim(coalesce(p_remarks, '')) = '' THEN remarks ELSE p_remarks END,
    updated_at           = v_now
  WHERE id = p_order_id;

  INSERT INTO public.advance_order_timeline (
    advance_order_id, event_type, label, remarks, created_by, created_at
  ) VALUES
    (p_order_id, 'remaining_payment_received', 'Remaining Payment Received', coalesce(p_remarks, ''), auth.uid(), v_now),
    (p_order_id, 'invoice_generated',          'Invoice Generated',          v_invoice,               auth.uid(), v_now);

  RETURN QUERY SELECT v_order_id, v_invoice, v_now;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_advance_order_v2(uuid, text, numeric, text, numeric, numeric, text)
  TO public, anon, authenticated;

-- 5. RLS policy fix — admin/staff login in this app (src/store/store.ts)
-- is a client-side ID/password gate, NOT a real Supabase auth session.
-- That means every request from the dashboard runs as the anon role, so
-- the "TO authenticated" policies created by migration 0001 (new_modules)
-- above would silently block admins from using Expenses/Attendance/
-- Inventory logging. Widen them to match the rest of the app's tables.
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.inventory_logs;
DROP POLICY IF EXISTS "Enable insert access for all authenticated users" ON public.inventory_logs;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.expense_categories;
DROP POLICY IF EXISTS "Enable all access for all authenticated users" ON public.expense_categories;
DROP POLICY IF EXISTS "Enable all access for all authenticated users" ON public.expenses;
DROP POLICY IF EXISTS "Enable all access for all authenticated users" ON public.staff;
DROP POLICY IF EXISTS "Enable all access for all authenticated users" ON public.attendance;

DROP POLICY IF EXISTS "Enable all access for inventory_logs" ON public.inventory_logs;
CREATE POLICY "Enable all access for inventory_logs" ON public.inventory_logs FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable all access for expense_categories" ON public.expense_categories;
CREATE POLICY "Enable all access for expense_categories" ON public.expense_categories FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable all access for expenses" ON public.expenses;
CREATE POLICY "Enable all access for expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable all access for staff" ON public.staff;
CREATE POLICY "Enable all access for staff" ON public.staff FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable all access for attendance" ON public.attendance;
CREATE POLICY "Enable all access for attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);

-- 6. Saree/Salwar re-categorization (direct, name-based). The WITH-catalog
-- UPDATE in section 5 above (migration 20260904) requires the whole script
-- to reach that point without erroring; this direct-by-name UPDATE is a
-- guaranteed fallback that reassigns the 15 Saree/Salwar items out of
-- Tailoring using the confirmed live category_id values (Saree=14,
-- Salwar=15). Safe to re-run — it's a no-op once already applied.
UPDATE public.products
SET category = 'Saree', category_id = (SELECT id FROM public.categories WHERE name_en = 'Saree'), updated_at = NOW()
WHERE name IN (
  'Blouse with Lining',
  'Blouse with Lining & Cup',
  'Blouse with Stones',
  'Blouse with Laces',
  'Blouse with Aari Laces',
  'Falls Stitching',
  'Falls',
  'Saree Pre Pleating',
  'Readymade Saree',
  'Aari Work Blouse',
  'Readymade Blouse'
);

UPDATE public.products
SET category = 'Salwar', category_id = (SELECT id FROM public.categories WHERE name_en = 'Salwar'), updated_at = NOW()
WHERE name IN (
  'Punjabi Suit without Lining',
  'Punjabi Suit with Lining',
  'Anarkali without Lining',
  'Anarkali with Lining'
);

-- 7. Self-healing duplicate guard. Section 5's main catalog UPDATE matches by
-- product name only and sets is_active = TRUE — so if it (or an older cached
-- copy of this script) ever runs again while a stray "Tailoring" copy of one
-- of these 15 items coexists with its correctly-categorized Saree/Salwar
-- copy, both rows get reactivated and the duplicate resurfaces in the admin
-- catalog. This retires the Tailoring copy again whenever that happens,
-- keeping only the Saree/Salwar copy live. Safe to re-run.
UPDATE public.products dup
SET is_active = FALSE, updated_at = NOW()
FROM public.products keep
WHERE dup.category = 'Tailoring'
  AND keep.category IN ('Saree', 'Salwar')
  AND keep.is_active = TRUE
  AND dup.id <> keep.id
  AND LOWER(BTRIM(dup.name)) = LOWER(BTRIM(keep.name))
  AND LOWER(BTRIM(dup.name)) IN (
    'blouse with lining', 'blouse with lining & cup', 'blouse with stones', 'blouse with laces',
    'blouse with aari laces', 'falls stitching', 'falls', 'saree pre pleating', 'readymade saree',
    'aari work blouse', 'readymade blouse', 'punjabi suit without lining', 'punjabi suit with lining',
    'anarkali without lining', 'anarkali with lining'
  );

-- 8. Fix the staff attendance clock columns. Migration 0001 (new_modules)
-- created public.attendance with a column named check_in_time and no
-- clock-out column at all, but both StaffPunch.tsx (the public self-punch
-- page) and Attendance.tsx (the admin view) read/write clock_in and
-- clock_out — a naming mismatch that has never worked, since PostgREST
-- errors with "column does not exist" on every Punch In attempt. Rename the
-- existing column (preserving any punch-in history already recorded) and
-- add the missing clock_out column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'check_in_time'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'clock_in'
  ) THEN
    ALTER TABLE public.attendance RENAME COLUMN check_in_time TO clock_in;
  END IF;
END;
$$;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clock_in TIMESTAMPTZ;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clock_out TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';

-- FILE: 20260906_0001_add_reconciliation_reason.sql
-- ═══════════════════════════════════════════════════════════
-- Adds 'reconciliation' (set-exact-count stock takes) as a first-class
-- inventory_logs.reason, alongside sale/restock/return/manual_adjustment/loss.
-- Until this migration is applied, the app logs reconciliation adjustments
-- as 'manual_adjustment' so it doesn't hit the old constraint.

ALTER TABLE public.inventory_logs DROP CONSTRAINT IF EXISTS inventory_logs_reason_check;

ALTER TABLE public.inventory_logs
  ADD CONSTRAINT inventory_logs_reason_check
  CHECK (reason IN ('sale', 'restock', 'return', 'manual_adjustment', 'loss', 'reconciliation'));

-- FILE: 20260907_0001_fix_attendance_clock_columns.sql
-- ═══════════════════════════════════════════════════════════
-- Fix the staff attendance clock columns. Migration 0001 (new_modules)
-- created public.attendance with a column named check_in_time and no
-- clock-out column at all, but both StaffPunch.tsx (the public self-punch
-- page) and Attendance.tsx (the admin view) read/write clock_in and
-- clock_out — a naming mismatch that has never worked, since PostgREST
-- errors with "Could not find the 'clock_in' column of 'attendance' in the
-- schema cache" on every Punch In attempt. Rename the existing column
-- (preserving any punch-in history already recorded) and add the missing
-- clock_out column.
--
-- (This duplicates the fix already merged in earlier via the
-- 20260904_0001_tailoring_catalog_retired.sql section above; kept here too,
-- idempotently, so this file matches the migrations/ directory 1:1.)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'check_in_time'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'clock_in'
  ) THEN
    ALTER TABLE public.attendance RENAME COLUMN check_in_time TO clock_in;
  END IF;
END;
$$;

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clock_in TIMESTAMPTZ;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clock_out TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';

-- FILE: 20260914_0001_rice_n_rooster_rebrand.sql
-- ═══════════════════════════════════════════════════════════
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
