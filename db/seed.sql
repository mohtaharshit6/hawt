-- Hawt Product Seed Data
-- Run after schema.sql: psql -U postgres -d hawt -f db/seed.sql

INSERT INTO products (name, description, price, stock, image_url, image_alt, category, sku, badge, sub, sizes, out_of_stock, detail) VALUES
(
  'box hoodie',
  '240 gsm brushed-back french terry, boxed shoulders, dropped armhole. heavyweight on purpose. built to outlive the trend.',
  5499.00, 50,
  'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=900&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=900&q=80&auto=format&fit=crop',
  'tops', 'HWT-BX-2403-CHR', 'new', 'charcoal · heavyweight fleece',
  '["XS","S","M","L","XL","XXL"]', '["XXL"]',
  '["240 gsm french terry · 100% cotton","oversized fit · size down for relaxed","embroidered bang mark · centre back","cut & sewn in tirupur"]'
),
(
  'cargo 03',
  'twill cotton cargo, double-knee construction, six pockets. relaxed straight cut, cropped to the ankle.',
  6999.00, 40,
  'https://images.unsplash.com/photo-1542272604-787c3835535d?w=900&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517438476312-10d79c077509?w=900&q=80&auto=format&fit=crop',
  'bottoms', 'HWT-CG-2403-BNE', null, 'bone · double-knee',
  '["28","30","32","34","36"]', '[]',
  '["380 gsm cotton twill · garment-washed","six functional pockets · YKK hardware","double-knee · reinforced seat","cut & sewn in tirupur"]'
),
(
  'low 01',
  'low-top trainer on a chunky cup sole. full-grain leather upper, sand suede overlays. true to size.',
  9499.00, 30,
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=900&q=80&auto=format&fit=crop',
  'footwear', 'HWT-SN-2403-BNE', 'drop / 03', 'bone / sand',
  '["7","8","9","10","11","12"]', '["7","12"]',
  '["full-grain leather upper","suede overlays · ortholite footbed","chunky cup sole · 38mm stack","made in spain"]'
),
(
  'crew essential',
  'midweight crewneck in ring-spun cotton. boxy fit, ribbed cuffs and hem. the everyday.',
  2799.00, 60,
  'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=900&q=80&auto=format&fit=crop',
  'tops', 'HWT-CR-2403-INK', null, 'ink · midweight',
  '["XS","S","M","L","XL"]', '[]',
  '["320 gsm ring-spun cotton","boxy fit · drops below the hip","tonal flatlock seams","cut & sewn in tirupur"]'
),
(
  'bang cap',
  'six-panel washed cotton cap. low-profile crown, curved brim. embroidered sand bang on the front.',
  1499.00, 80,
  'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=900&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=900&q=80&auto=format&fit=crop',
  'accessories', 'HWT-CP-2403-INK', null, 'ink · embroidered',
  '["ONE SIZE"]', '[]',
  '["washed cotton twill","low-profile six-panel","embroidered bang · sand thread","adjustable buckle strap"]'
),
(
  'oversized tee',
  'heavyweight 220 gsm jersey, dropped shoulders, boxed body. the heavy tee, back in sand.',
  1999.00, 45,
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=900&q=80&auto=format&fit=crop',
  'tops', 'HWT-TE-2403-SND', 'restock', 'sand · 220 gsm',
  '["XS","S","M","L","XL","XXL"]', '["S"]',
  '["220 gsm cotton jersey","dropped shoulder · boxed body","garment-dyed for softness","cut & sewn in tirupur"]'
),
(
  'co-ord 01',
  'matching co-ord — boxed crewneck and tapered sweat. wear together, wear apart. always together.',
  7499.00, 25,
  'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=900&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=900&q=80&auto=format&fit=crop',
  'tops', 'HWT-CO-2403-ASH', 'drop / 03', 'ash · top + sweat',
  '["S","M","L","XL"]', '[]',
  '["320 gsm french terry · garment-dyed","crewneck + matching sweat","tonal flame stitch · left sleeve","cut & sewn in tirupur"]'
),
(
  'relaxed sweat',
  'relaxed tapered sweatpant. elastic waist, drawcord, cuffed hem. lounges like a sweatpant, looks like a trouser.',
  4499.00, 55,
  'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=900&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=900&q=80&auto=format&fit=crop',
  'bottoms', 'HWT-SW-2403-INK', null, 'ink · 320 gsm',
  '["XS","S","M","L","XL"]', '[]',
  '["320 gsm french terry","relaxed fit · tapered to cuff","drawstring + elastic waist","cut & sewn in tirupur"]'
);
