/**
 * HAWT! E-Commerce — Product Seeder
 *
 * 40 fully hardcoded products, 5 per category.
 * No random generators. No alt images (alt_image_url = null for all products).
 * Every image_url is an explicitly assigned, verified Unsplash fashion photo.
 *
 * Usage:
 *   npm run db:seed          (recommended)
 *   node db/seed.js          (direct)
 *
 * Requires DATABASE_URL in .env.
 * WARNING: Truncates products + product_variants (cascades to cart_items /
 *          order_items). Do NOT run against production.
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function img(file) {
  return `/images/products/${file}`;
}

// ─── CATEGORY → SKU PREFIX MAP ───────────────────────────────────────────────

const CATEGORY_SKU = {
  'Dresses':     'DR',
  'Shirts':      'SH',
  'Bottoms':     'BT',
  'Co-ords':     'CO',
  'Accessories': 'AC',
  'New In':      'NI',
  'Sale':        'SL',
  'Clearance':   'CL',
};

// ─── HARDCODED PRODUCT CATALOGUE ─────────────────────────────────────────────
//
// 40 products · 5 per category · alt_image_url is null for EVERY product.
// Each image_url is a deliberately chosen, verified Unsplash fashion photo ID.
//
// sizes:  clothing default is ['XS','S','M','L','XL'], accessories use ['ONE SIZE'].

const PRODUCTS = [

  // ─────────────────────────────────────────────────────────────────────────
  // DRESSES
  // ─────────────────────────────────────────────────────────────────────────
  {
    name:          'Floral Wrap Midi Dress',
    description:   'V-neck wrap silhouette in cotton poplin with an all-over floral print. Adjustable tie waist, flutter sleeves, and a below-the-knee hem. Lined bodice.',
    sub:           'dusty rose floral · cotton poplin',
    category:      'Dresses',
    base_price:    2499,
    sale_price:    null,
    badge:         null,
    image_url:     img('dress-1.png'),
    alt_image_url: null,
    tags:          ['dresses', 'midi', 'floral', 'wrap', 'summer'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Satin Slip Dress',
    description:   'Bias-cut slip dress in liquid satin. Adjustable spaghetti straps, lace-trimmed hem, and a thigh-high side slit. Effortless dressed up or down.',
    sub:           'midnight · satin',
    category:      'Dresses',
    base_price:    3299,
    sale_price:    null,
    badge:         null,
    image_url:     img('dress-2.png'),
    alt_image_url: null,
    tags:          ['dresses', 'slip', 'satin', 'date night', 'evening'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Linen Maxi Dress',
    description:   'Relaxed maxi dress in breathable linen blend. Square neck, smocked back panel for stretch, and wide-set straps. Ideal for warm-weather dressing.',
    sub:           'sand · linen blend',
    category:      'Dresses',
    base_price:    2899,
    sale_price:    null,
    badge:         null,
    image_url:     img('dress-3.png'),
    alt_image_url: null,
    tags:          ['dresses', 'maxi', 'linen', 'resort', 'summer'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Smocked Cotton Sundress',
    description:   'Full smocked bodice in cotton gauze with a tiered skirt falling to the knee. Thin shoulder straps with adjustable tie. Washed for a lived-in feel.',
    sub:           'ivory · cotton gauze',
    category:      'Dresses',
    base_price:    1999,
    sale_price:    null,
    badge:         null,
    image_url:     img('dress-4.png'),
    alt_image_url: null,
    tags:          ['dresses', 'sundress', 'smocked', 'casual', 'brunch'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Ruched Bodycon Mini Dress',
    description:   'Figure-skimming mini in stretch crepe with all-over ruching. Square neck, short sleeves, and a back zip closure. Wear it straight from work to dinner.',
    sub:           'charcoal · stretch crepe',
    category:      'Dresses',
    base_price:    2299,
    sale_price:    null,
    badge:         null,
    image_url:     img('dress-5.png'),
    alt_image_url: null,
    tags:          ['dresses', 'mini', 'bodycon', 'ruched', 'evening'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SHIRTS
  // ─────────────────────────────────────────────────────────────────────────
  {
    name:          'Oversized Linen Shirt',
    description:   'Relaxed-fit shirt in 100% linen with a classic collar, chest pocket, and dropped shoulders. Tuck it in or wear it open as a beach cover-up.',
    sub:           'chalk · 100% linen',
    category:      'Shirts',
    base_price:    1799,
    sale_price:    null,
    badge:         null,
    image_url:     img('top-1.png'),
    alt_image_url: null,
    tags:          ['shirts', 'linen', 'oversized', 'casual', 'resort'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Ribbed Crop Top',
    description:   'Close-fit crop top in cotton rib knit. Thin straps, scoop neck, and a cropped hem that hits above the navel. Pairs with everything.',
    sub:           'bone · cotton rib',
    category:      'Shirts',
    base_price:    999,
    sale_price:    null,
    badge:         null,
    image_url:     img('top-2.png'),
    alt_image_url: null,
    tags:          ['shirts', 'crop', 'ribbed', 'casual', 'everyday'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Puff-Sleeve Blouse',
    description:   'Cotton poplin blouse with exaggerated puff sleeves gathered at the cuff. Relaxed body, keyhole neckline, and a button-through front.',
    sub:           'ivory · cotton poplin',
    category:      'Shirts',
    base_price:    1599,
    sale_price:    null,
    badge:         null,
    image_url:     img('top-3.png'),
    alt_image_url: null,
    tags:          ['shirts', 'blouse', 'puff-sleeve', 'feminine', 'workwear'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Boxy Graphic Tee',
    description:   'Garment-washed boxy tee in 100% organic cotton. Cut & sewn in Tirupur. Crew neck, dropped shoulders, heavyweight 220gsm fabric.',
    sub:           'sand · organic cotton 220gsm',
    category:      'Shirts',
    base_price:    1199,
    sale_price:    null,
    badge:         null,
    image_url:     img('top-4.png'),
    alt_image_url: null,
    tags:          ['shirts', 'tee', 'boxy', 'cotton', 'casual'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Sheer Floral Blouse',
    description:   'Semi-sheer georgette blouse with a floral burnout print. V-neck, relaxed long sleeves with a slight cuff. Layer over a cami for an effortless look.',
    sub:           'blush floral · georgette',
    category:      'Shirts',
    base_price:    1899,
    sale_price:    null,
    badge:         null,
    image_url:     img('top-5.png'),
    alt_image_url: null,
    tags:          ['shirts', 'blouse', 'sheer', 'floral', 'feminine'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BOTTOMS
  // ─────────────────────────────────────────────────────────────────────────
  {
    name:          'High-Waisted Wide Leg Trousers',
    description:   'Tailored wide-leg trousers in a linen blend with a high rise, front pleats, and side pockets. Press-stud fly with a concealed hook-and-bar fastening.',
    sub:           'ecru · linen blend',
    category:      'Bottoms',
    base_price:    2499,
    sale_price:    null,
    badge:         null,
    image_url:     img('bottom-1.png'),
    alt_image_url: null,
    tags:          ['bottoms', 'trousers', 'wide-leg', 'linen', 'workwear'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Denim Mini Skirt',
    description:   'Classic five-pocket mini skirt in mid-weight denim. High waist, straight hem, zip fly with button. Washed to a light blue finish.',
    sub:           'light wash · mid-weight denim',
    category:      'Bottoms',
    base_price:    1599,
    sale_price:    null,
    badge:         null,
    image_url:     img('bottom-2.png'),
    alt_image_url: null,
    tags:          ['bottoms', 'skirt', 'mini', 'denim', 'casual'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Linen Cargo Pants',
    description:   'Relaxed-fit cargo pants in 100% linen. Two front slash pockets, two side cargo pockets with snap-flap closures, and an elasticated drawcord waist.',
    sub:           'khaki · 100% linen',
    category:      'Bottoms',
    base_price:    2199,
    sale_price:    null,
    badge:         null,
    image_url:     img('bottom-3.png'),
    alt_image_url: null,
    tags:          ['bottoms', 'cargo', 'linen', 'casual', 'festival'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Flared Midi Skirt',
    description:   'Flowy flared midi skirt in lightweight crepe. High-elasticated waist, an A-line silhouette that flares at the knee, and a back vent.',
    sub:           'rust · crepe',
    category:      'Bottoms',
    base_price:    1899,
    sale_price:    null,
    badge:         null,
    image_url:     img('bottom-4.png'),
    alt_image_url: null,
    tags:          ['bottoms', 'skirt', 'midi', 'flared', 'casual'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Pleated Tailored Shorts',
    description:   'Mid-rise tailored shorts in cotton twill with front pleats, side pockets, and a clean hemline. A smarter short for every occasion.',
    sub:           'stone · cotton twill',
    category:      'Bottoms',
    base_price:    1499,
    sale_price:    null,
    badge:         null,
    image_url:     img('bottom-5.png'),
    alt_image_url: null,
    tags:          ['bottoms', 'shorts', 'tailored', 'pleated', 'workwear'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CO-ORDS
  // ─────────────────────────────────────────────────────────────────────────
  {
    name:          'Linen Shirt & Shorts Co-ord',
    description:   'Matching co-ord: a relaxed camp-collar shirt and mid-length shorts in the same stone linen blend. Wear together or style separately.',
    sub:           'stone · linen blend',
    category:      'Co-ords',
    base_price:    3299,
    sale_price:    null,
    badge:         null,
    image_url:     img('coord-1.png'),
    alt_image_url: null,
    tags:          ['co-ords', 'linen', 'set', 'matching', 'resort'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Ribbed Crop Top & Midi Skirt Set',
    description:   'Two-piece set in cotton rib: a fitted sleeveless crop top with a scoop neck, paired with a matching high-waist midi skirt with a subtle side split.',
    sub:           'bone · cotton rib',
    category:      'Co-ords',
    base_price:    2499,
    sale_price:    null,
    badge:         null,
    image_url:     img('coord-2.png'),
    alt_image_url: null,
    tags:          ['co-ords', 'ribbed', 'crop', 'skirt', 'set'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Waffle Knit Lounge Set',
    description:   'Matching loungewear set in waffle-knit cotton: an oversized boxy crop top and wide-leg pants with an elasticated drawcord waist.',
    sub:           'sage · waffle knit cotton',
    category:      'Co-ords',
    base_price:    2899,
    sale_price:    null,
    badge:         null,
    image_url:     img('coord-3.png'),
    alt_image_url: null,
    tags:          ['co-ords', 'lounge', 'waffle-knit', 'relaxed', 'casual'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Satin Cami & Mini Skirt Set',
    description:   'Elegant matching set in satin: a slim-fit cami top with adjustable straps and a coordinating mini skirt with an elasticated waist and bias-cut hem.',
    sub:           'midnight · satin',
    category:      'Co-ords',
    base_price:    3499,
    sale_price:    null,
    badge:         null,
    image_url:     img('coord-4.png'),
    alt_image_url: null,
    tags:          ['co-ords', 'satin', 'cami', 'mini', 'evening'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Tailored Blazer & Trouser Set',
    description:   'Power two-piece in stretch cotton twill: a single-button blazer with notch lapels, matched with straight-cut trousers with a mid-rise waist.',
    sub:           'charcoal · stretch cotton twill',
    category:      'Co-ords',
    base_price:    4999,
    sale_price:    null,
    badge:         null,
    image_url:     img('coord-5.png'),
    alt_image_url: null,
    tags:          ['co-ords', 'blazer', 'trousers', 'tailored', 'workwear'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ACCESSORIES
  // ─────────────────────────────────────────────────────────────────────────
  {
    name:          'Chunky Gold Hoop Earrings',
    description:   'Oversized sculptural hoop earrings in high-polish 18k gold-plated brass. Lightweight despite their size. Nickel-free and hypoallergenic.',
    sub:           '18k gold-plated brass',
    category:      'Accessories',
    base_price:    799,
    sale_price:    null,
    badge:         null,
    image_url:     img('acc-1.png'),
    alt_image_url: null,
    tags:          ['accessories', 'earrings', 'gold', 'hoop', 'jewellery'],
    sizes:         ['ONE SIZE'],
  },
  {
    name:          'Leather Crossbody Bag',
    description:   'Compact crossbody in pebbled vegan leather with a zip-top closure, one interior slip pocket, and an adjustable woven strap.',
    sub:           'caramel · pebbled vegan leather',
    category:      'Accessories',
    base_price:    2999,
    sale_price:    null,
    badge:         null,
    image_url:     img('acc-2.png'),
    alt_image_url: null,
    tags:          ['accessories', 'bag', 'crossbody', 'vegan-leather', 'everyday'],
    sizes:         ['ONE SIZE'],
  },
  {
    name:          'Woven Bucket Hat',
    description:   'Classic bucket hat in tightly woven cotton twill. Structured brim, sweatband lining, and a tonal grosgrain ribbon. Sun-smart and stylish.',
    sub:           'sand · cotton twill',
    category:      'Accessories',
    base_price:    1299,
    sale_price:    null,
    badge:         null,
    image_url:     img('acc-3.png'),
    alt_image_url: null,
    tags:          ['accessories', 'hat', 'bucket-hat', 'cotton', 'resort'],
    sizes:         ['ONE SIZE'],
  },
  {
    name:          'Canvas Market Tote',
    description:   'Oversized market tote in washed canvas. Reinforced double handles, an interior zip pocket, and a snap-button top closure. Holds more than you think.',
    sub:           'chalk · washed canvas',
    category:      'Accessories',
    base_price:    899,
    sale_price:    null,
    badge:         null,
    image_url:     img('acc-4.png'),
    alt_image_url: null,
    tags:          ['accessories', 'tote', 'canvas', 'bag', 'everyday'],
    sizes:         ['ONE SIZE'],
  },
  {
    name:          'Oval Tortoise Sunglasses',
    description:   'Oversized oval frames in Italian acetate with gradient brown lenses. UV400 protection. Spring-hinge temples for all-day comfort.',
    sub:           'tortoise · acetate · UV400',
    category:      'Accessories',
    base_price:    1499,
    sale_price:    null,
    badge:         null,
    image_url:     img('acc-5.png'),
    alt_image_url: null,
    tags:          ['accessories', 'sunglasses', 'tortoise', 'oval', 'resort'],
    sizes:         ['ONE SIZE'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // NEW IN
  // ─────────────────────────────────────────────────────────────────────────
  {
    name:          'Cut-Out Halter Top',
    description:   'Structured halter top in cotton jersey with a geometric cut-out at the midriff. Tie closure at the neck and back. A statement piece for the new season.',
    sub:           'ink · cotton jersey',
    category:      'New In',
    base_price:    1299,
    sale_price:    null,
    badge:         'new',
    image_url:     img('top-6.png'),
    alt_image_url: null,
    tags:          ['new-in', 'halter', 'cut-out', 'trending'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Y2K Cargo Mini Skirt',
    description:   'Low-rise cargo mini skirt in washed denim with two oversized side cargo pockets, contrast stitching, and a zip fly.',
    sub:           'washed grey · denim',
    category:      'New In',
    base_price:    1799,
    sale_price:    null,
    badge:         'new',
    image_url:     img('bottom-6.png'),
    alt_image_url: null,
    tags:          ['new-in', 'cargo', 'mini', 'denim', 'y2k', 'trending'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Asymmetric Draped Top',
    description:   'One-shoulder draped top in lightweight crepe with an asymmetric hemline. The excess fabric falls into a dramatic side drape. Fully lined.',
    sub:           'stone · crepe',
    category:      'New In',
    base_price:    1699,
    sale_price:    null,
    badge:         'new',
    image_url:     img('top-7.png'),
    alt_image_url: null,
    tags:          ['new-in', 'asymmetric', 'draped', 'one-shoulder', 'trending'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Barrel Leg Jeans',
    description:   'High-rise waist that tapers into a wide barrel through the thigh, narrowing again at the cropped hem. Rigid selvedge-style denim. The shape of the season.',
    sub:           'light wash · rigid denim',
    category:      'New In',
    base_price:    2999,
    sale_price:    null,
    badge:         'new',
    image_url:     img('bottom-7.png'),
    alt_image_url: null,
    tags:          ['new-in', 'jeans', 'barrel-leg', 'denim', 'trending'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Crochet Trim Midi Dress',
    description:   'Cotton midi dress with handmade crochet trim at the neckline, hem, and cuffs. Relaxed silhouette, smocked back, and adjustable tie straps.',
    sub:           'ivory · cotton · crochet trim',
    category:      'New In',
    base_price:    2799,
    sale_price:    null,
    badge:         'new',
    image_url:     img('dress-6.png'),
    alt_image_url: null,
    tags:          ['new-in', 'dress', 'crochet', 'midi', 'trending', 'resort'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SALE
  // ─────────────────────────────────────────────────────────────────────────
  {
    name:          'Tiered Ruffle Midi Dress',
    description:   'Three-tier ruffle midi dress in chiffon with a smocked bodice and thin shoulder straps. Was a best-seller from our summer edit.',
    sub:           'dusty rose · chiffon',
    category:      'Sale',
    base_price:    3499,
    sale_price:    1999,
    badge:         'sale',
    image_url:     img('dress-7.png'),
    alt_image_url: null,
    tags:          ['sale', 'dresses', 'midi', 'ruffle', 'chiffon'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Smocked Puff-Sleeve Blouse',
    description:   'Cotton poplin blouse with a fully smocked back bodice and dramatic puff sleeves gathered at a deep cuff. V-neck and a slightly cropped hem.',
    sub:           'white · cotton poplin',
    category:      'Sale',
    base_price:    2199,
    sale_price:    1299,
    badge:         'sale',
    image_url:     img('top-8.png'),
    alt_image_url: null,
    tags:          ['sale', 'shirts', 'blouse', 'smocked', 'puff-sleeve'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Wide Leg Linen Pants',
    description:   'Effortless wide-leg pants in breathable linen with a pull-on elasticated waist, side pockets, and a floor-grazing hem.',
    sub:           'sand · 100% linen',
    category:      'Sale',
    base_price:    2799,
    sale_price:    1699,
    badge:         'sale',
    image_url:     img('bottom-8.png'),
    alt_image_url: null,
    tags:          ['sale', 'bottoms', 'trousers', 'linen', 'wide-leg'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Floral Print Wrap Skirt',
    description:   'Lightweight wrap skirt in a bold floral print on crepe. Adjustable tie waist and a flowing midi length. Easy to pack, impossible to ignore.',
    sub:           'floral multi · crepe',
    category:      'Sale',
    base_price:    1999,
    sale_price:    1199,
    badge:         'sale',
    image_url:     img('coord-6.png'),
    alt_image_url: null,
    tags:          ['sale', 'bottoms', 'skirt', 'floral', 'wrap'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Camp Collar Stripe Shirt',
    description:   'Open-collar camp shirt in a classic candy stripe cotton poplin. Short sleeves, chest patch pocket, and a straight hem. Previous season, still perfect.',
    sub:           'chalk stripe · cotton poplin',
    category:      'Sale',
    base_price:    2299,
    sale_price:    1399,
    badge:         'sale',
    image_url:     img('top-9.png'),
    alt_image_url: null,
    tags:          ['sale', 'shirts', 'camp-collar', 'stripe', 'cotton'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CLEARANCE
  // ─────────────────────────────────────────────────────────────────────────
  {
    name:          'Oversized Stripe Shirt',
    description:   'End-of-season clearance. Drop-shoulder shirt in yarn-dyed stripe cotton. Previous drop — same quality, serious markdown. While stocks last.',
    sub:           'multi stripe · cotton',
    category:      'Clearance',
    base_price:    2199,
    sale_price:    799,
    badge:         'clearance',
    image_url:     img('top-10.png'),
    alt_image_url: null,
    tags:          ['clearance', 'shirts', 'stripe', 'oversized'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Cotton Smocked Maxi Dress',
    description:   'Clearance price on this cotton maxi from a previous drop. Full smocked bodice, tiered skirt, adjustable straps. The fit is exactly the same — the price is not.',
    sub:           'terracotta · cotton',
    category:      'Clearance',
    base_price:    2499,
    sale_price:    899,
    badge:         'clearance',
    image_url:     img('coord-7.png'),
    alt_image_url: null,
    tags:          ['clearance', 'dresses', 'maxi', 'smocked', 'cotton'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Palazzo Wide Leg Pants',
    description:   'Flowing palazzo pants in lightweight crepe with a high elasticated waist and a dramatic wide leg. Previous season — stunning fabric at clearance pricing.',
    sub:           'dusty plum · crepe',
    category:      'Clearance',
    base_price:    2799,
    sale_price:    999,
    badge:         'clearance',
    image_url:     img('coord-8.png'),
    alt_image_url: null,
    tags:          ['clearance', 'bottoms', 'palazzo', 'wide-leg', 'crepe'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Puff-Sleeve Mini Dress',
    description:   'Previous drop. Cotton mini dress with statement puff sleeves, a fitted bodice, and a flared hem at the thigh. Full clearance — don\'t sleep on it.',
    sub:           'cobalt · cotton',
    category:      'Clearance',
    base_price:    2999,
    sale_price:    1099,
    badge:         'clearance',
    image_url:     img('coord-9.png'),
    alt_image_url: null,
    tags:          ['clearance', 'dresses', 'mini', 'puff-sleeve'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    name:          'Mesh Insert Tank Top',
    description:   'Cotton jersey tank with sheer mesh panels at the shoulders and sides. Minimal and modern. End-of-line clearance.',
    sub:           'ink · cotton jersey · mesh',
    category:      'Clearance',
    base_price:    1499,
    sale_price:    499,
    badge:         'clearance',
    image_url:     img('top-11.png'),
    alt_image_url: null,
    tags:          ['clearance', 'shirts', 'tank', 'mesh', 'cotton'],
    sizes:         ['XS', 'S', 'M', 'L', 'XL'],
  },
];

// ─── SEED ─────────────────────────────────────────────────────────────────────

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('⚡  Truncating product_variants + products …');
    await client.query(
      'TRUNCATE product_variants, products RESTART IDENTITY CASCADE'
    );

    const allVariants = [];
    const catCounters = {};

    for (let i = 0; i < PRODUCTS.length; i++) {
      const p    = PRODUCTS[i];
      const code = CATEGORY_SKU[p.category];

      if (!code) {
        console.warn(`  [SKIP] Unknown category: "${p.category}"`);
        continue;
      }

      catCounters[p.category] = (catCounters[p.category] || 0) + 1;
      const catIdx   = catCounters[p.category];
      const slug     = `${slugify(p.name)}-${code.toLowerCase()}-${String(catIdx).padStart(3, '0')}`;
      const skuPfx   = `HWT-${code}-${String(i + 1).padStart(3, '0')}`;

      const { rows } = await client.query(
        `INSERT INTO products
           (name, slug, description, category, sku_prefix,
            base_price, sale_price, image_url, alt_image_url,
            badge, sub, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
        [
          p.name,
          slug,
          p.description,
          p.category,
          skuPfx,
          p.base_price.toFixed(2),
          p.sale_price != null ? p.sale_price.toFixed(2) : null,
          p.image_url,
          null,                        // alt_image_url always null
          p.badge  || null,
          p.sub    || null,
          p.tags   || [],
        ]
      );

      const productId = rows[0].id;
      const sizes     = p.sizes || ['XS', 'S', 'M', 'L', 'XL'];

      for (const size of sizes) {
        allVariants.push({
          product_id:   productId,
          size,
          sku:          `${skuPfx}-${size.replace(/\s+/g, '')}`,
          stock_qty:    randInt(12, 60),
          reserved_qty: 0,
        });
      }

      console.log(`  [${code}] ${p.name}`);
    }

    // ── Batch-insert variants ──────────────────────────────────────────────
    console.log(`\n  Inserting ${allVariants.length} variants …`);

    const placeholders = [];
    const params       = [];
    let   n            = 1;

    for (const v of allVariants) {
      placeholders.push(`($${n},$${n+1},$${n+2},$${n+3},$${n+4})`);
      params.push(v.product_id, v.size, v.sku, v.stock_qty, v.reserved_qty);
      n += 5;
    }

    await client.query(
      `INSERT INTO product_variants (product_id, size, sku, stock_qty, reserved_qty)
       VALUES ${placeholders.join(',')}`,
      params
    );

    await client.query('COMMIT');

    const catSummary = Object.entries(catCounters)
      .map(([name, count]) => `${name}(${count})`)
      .join(' · ');

    console.log('');
    console.log('✅  Seed complete.');
    console.log(`    Products : ${PRODUCTS.length}`);
    console.log(`    Variants : ${allVariants.length}`);
    console.log(`    ${catSummary}`);
    console.log('');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Seed failed — rolled back.\n', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
