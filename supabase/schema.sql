-- ==========================================================
-- ANA CHIANG MAI - DATABASE SCHEMA (SUPABASE POSTGRESQL)
-- ==========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(64) NOT NULL DEFAULT '☕',
  subtitle TEXT,
  image TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255),
  category_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL,
  price INT NOT NULL, -- price in thousands (k) or VND
  price_formatted VARCHAR(64) NOT NULL,
  rating NUMERIC(2,1) NOT NULL DEFAULT 5.0,
  review_count INT NOT NULL DEFAULT 0,
  image TEXT NOT NULL,
  description TEXT,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_thai_special BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  badge VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  order_number VARCHAR(32) NOT NULL UNIQUE,
  table_number INT NOT NULL, -- 1 to 5
  table_name VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'NEW', -- NEW, CONFIRMED, PREPARING, READY, COMPLETED, CANCELLED
  subtotal INT NOT NULL DEFAULT 0,
  discount INT NOT NULL DEFAULT 0,
  shipping_fee INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  note TEXT,
  voucher_code VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  preparing_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- 4. ORDER ITEMS (IMMUTABLE SNAPSHOT)
CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  unit_price INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  selected_size VARCHAR(32),
  sugar_level VARCHAR(32),
  ice_level VARCHAR(32),
  toppings TEXT[],
  total_price INT NOT NULL,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. MONTHLY STATISTICS TABLE (SNAPSHOT ARCHIVE)
CREATE TABLE IF NOT EXISTS monthly_statistics (
  month VARCHAR(7) PRIMARY KEY, -- 'YYYY-MM', e.g. '2026-09'
  revenue BIGINT NOT NULL DEFAULT 0,
  completed_orders INT NOT NULL DEFAULT 0,
  items_sold INT NOT NULL DEFAULT 0,
  average_order_value BIGINT NOT NULL DEFAULT 0,
  product_stats JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Replica identity for realtime changes
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;
ALTER TABLE products REPLICA IDENTITY FULL;
ALTER TABLE categories REPLICA IDENTITY FULL;
ALTER TABLE monthly_statistics REPLICA IDENTITY FULL;

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_number);
CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON orders(completed_at);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_monthly_statistics_created_at ON monthly_statistics(created_at);

-- Enable Supabase Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE monthly_statistics;

-- Row Level Security (RLS)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_statistics ENABLE ROW LEVEL SECURITY;

-- Anonymous & Public Customer/Admin Policies
CREATE POLICY "Public can view active categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public can view available products" ON products FOR SELECT USING (true);
CREATE POLICY "Public can insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Public can update orders" ON orders FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete orders" ON orders FOR DELETE USING (true);
CREATE POLICY "Public can insert order items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view order items" ON order_items FOR SELECT USING (true);
CREATE POLICY "Public can update order items" ON order_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete order items" ON order_items FOR DELETE USING (true);
CREATE POLICY "Public can view monthly_statistics" ON monthly_statistics FOR SELECT USING (true);
CREATE POLICY "Public can insert monthly_statistics" ON monthly_statistics FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update monthly_statistics" ON monthly_statistics FOR UPDATE USING (true) WITH CHECK (true);

-- Authenticated Admin Policies (Full access)
CREATE POLICY "Admin full access categories" ON categories TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access products" ON products TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access orders" ON orders TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access order_items" ON order_items TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access monthly_statistics" ON monthly_statistics TO authenticated USING (true) WITH CHECK (true);

-- 6. AUTOMATED CLEANUP FUNCTION FOR EXPIRED UNACCEPTED ORDERS (> 1 HOUR)
CREATE OR REPLACE FUNCTION purge_expired_unaccepted_orders()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INT := 0;
BEGIN
  -- Strictly delete only orders that:
  -- 1. Status is 'NEW' (Admin has never confirmed or accepted)
  -- 2. Created more than 1 hour ago
  -- 3. Payment safety: payment_status is not 'PAID' and payment_status is not 'VERIFYING'
  WITH deleted_rows AS (
    DELETE FROM orders
    WHERE status = 'NEW'
      AND (payment_status IS NULL OR payment_status NOT IN ('PAID', 'VERIFYING'))
      AND created_at <= NOW() - INTERVAL '1 hour'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted_rows;
  
  RETURN deleted_count;
END;
$$;

-- Production pg_cron schedule (if pg_cron is enabled in Supabase):
-- SELECT cron.schedule(
--   'purge-expired-unaccepted-orders-every-10min',
--   '*/10 * * * *',
--   'SELECT purge_expired_unaccepted_orders()'
-- );


