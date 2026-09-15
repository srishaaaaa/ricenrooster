-- Fix "Supabase Backend Error: set-returning functions are not allowed in
-- WHERE" when completing an advance order (Receive Remaining Payment).
--
-- handle_advance_order_inventory_deduction() called jsonb_array_elements()
-- directly in the SELECT list and again in the WHERE clause of a FOR loop
-- query. Postgres allows a set-returning function in the FROM clause, but
-- never in WHERE — this always failed once an order actually reached
-- 'completed' status.

CREATE OR REPLACE FUNCTION public.handle_advance_order_inventory_deduction()
RETURNS TRIGGER AS $function$
DECLARE
    item RECORD;
    current_stock NUMERIC(12,3);
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        FOR item IN
            SELECT (elem->>'product_id')::BIGINT AS product_id,
                   (elem->>'quantity')::NUMERIC AS quantity
            FROM jsonb_array_elements(NEW.products) AS elem
            WHERE (elem->>'product_id') IS NOT NULL
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
