'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('./db');

const SIZES_WOMEN  = ['XS','S','M','L','XL'];
const SIZES_MEN    = ['S','M','L','XL','XXL'];
const SIZES_UNISEX = ['XS','S','M','L','XL','XXL'];

function variants(sizes, stock = 15) {
  return sizes.map(size => ({ size, stock_qty: stock }));
}

const products = [
  // ── TOPS / SHIRTS ──────────────────────────────────────────────────────────
  {
    name: 'Colorblock Raglan Oversized Tee',
    category: 'Shirts',
    base_price: 1299,
    badge: 'New In',
    sub: 'Easy-fit unisex drop-shoulder tee',
    description: 'White, grey and black colorblock panels on a relaxed raglan silhouette. Crafted in heavyweight 240 GSM cotton — structured enough to wear alone, soft enough to live in.',
    image_url: '/images/products/top-1.png',
    tags: ['oversized', 'tee', 'unisex', 'colorblock'],
    sizes: variants(SIZES_UNISEX),
  },
  {
    name: 'Off-Shoulder Ruched Crop Top',
    category: 'Shirts',
    base_price: 999,
    sale_price: 799,
    badge: 'Sale',
    sub: 'Chocolate brown bardot crop',
    description: 'A cinched twist-front detail draws the off-shoulder neckline into a flattering ruched gather. Stretch jersey fabric moves with you all day.',
    image_url: '/images/products/top-2.png',
    tags: ['crop', 'off-shoulder', 'ruched', 'women'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'One-Shoulder Cutout Crop Top',
    category: 'Shirts',
    base_price: 1099,
    badge: 'New In',
    sub: 'Taupe asymmetric cutout top',
    description: 'One shoulder, one cutout, infinite outfit possibilities. The asymmetric construction sits close to the body without clinging.',
    image_url: '/images/products/top-3.png',
    tags: ['crop', 'cutout', 'asymmetric', 'women'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Contrast Stitch Long-Sleeve Crop',
    category: 'Shirts',
    base_price: 1199,
    sub: 'Dark brown square-neck long-sleeve',
    description: 'Exposed contrast topstitching frames the square neckline and cuffs in a subtle utilitarian detail. Ribbed jersey for a second-skin fit.',
    image_url: '/images/products/top-4.png',
    tags: ['crop', 'long-sleeve', 'ribbed', 'women'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Waffle Knit Henley Long-Sleeve',
    category: 'Shirts',
    base_price: 1499,
    sub: 'Black textured henley for men',
    description: 'Classic henley button placket meets waffle-knit texture in a relaxed fit. Raglan sleeves and contrast stitching keep it modern.',
    image_url: '/images/products/top-5.png',
    tags: ['henley', 'waffle-knit', 'long-sleeve', 'men'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: 'Washed Oversized Polo',
    category: 'Shirts',
    base_price: 1399,
    sub: 'Charcoal acid-wash open collar polo',
    description: 'Garment-washed for an intentionally faded, worn-in look. The open resort collar and dropped shoulders make this the easiest top to reach for.',
    image_url: '/images/products/top-6.png',
    tags: ['polo', 'washed', 'oversized', 'men'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: 'Washed Muscle Sleeveless Tee',
    category: 'Shirts',
    base_price: 899,
    sale_price: 699,
    badge: 'Sale',
    sub: 'Charcoal drop-armhole tank',
    description: 'Wide-cut armholes and a relaxed boxy body in garment-washed cotton. No logo, no fuss — just a perfect layering piece or standalone summer essential.',
    image_url: '/images/products/top-7.png',
    tags: ['tank', 'muscle', 'sleeveless', 'men', 'washed'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: 'Abstract Ink Brush Resort Shirt',
    category: 'Shirts',
    base_price: 2199,
    badge: 'New In',
    sub: 'Ivory & grey brushstroke short-sleeve',
    description: 'Hand-painted ink brush strokes printed on lightweight viscose. Open camp collar and chest pocket — perfect from beach bar to rooftop.',
    image_url: '/images/products/top-8.png',
    tags: ['resort', 'print', 'camp-collar', 'men'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: 'Geometric Block Print Resort Shirt',
    category: 'Shirts',
    base_price: 2199,
    sub: 'Cream & black bold geometric print',
    description: 'Strong black geometric shapes contrast against an off-white ground. Soft viscose drape and a relaxed fit that works tucked or untucked.',
    image_url: '/images/products/top-9.png',
    tags: ['resort', 'geometric', 'camp-collar', 'men'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: 'Green Splatter Resort Shirt',
    category: 'Shirts',
    base_price: 2299,
    badge: 'New In',
    sub: 'Ivory & forest green paint-splatter print',
    description: 'Grunge-meets-resort: forest green ink splatter across a crisp off-white base. Lightweight and breezy for long summer days.',
    image_url: '/images/products/top-10.png',
    tags: ['resort', 'splatter', 'green', 'men'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: 'Whirlpool Abstract Resort Shirt',
    category: 'Shirts',
    base_price: 2299,
    sub: 'Ivory & black swirl print short-sleeve',
    description: 'Hypnotic concentric rings and dot patterns printed in rich black on ecru. The kind of shirt that starts conversations.',
    image_url: '/images/products/top-11.png',
    tags: ['resort', 'abstract', 'whirlpool', 'men'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: 'Tropical Eye Print Resort Shirt',
    category: 'Shirts',
    base_price: 2399,
    badge: 'New In',
    sub: 'Ivory resort shirt with palm & eye motifs',
    description: 'A surrealist blend of palm trees, eyes and sun symbols printed over an ivory base. Statement resort wear that travels well.',
    image_url: '/images/products/top-12.png',
    tags: ['resort', 'tropical', 'surrealist', 'men'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: '"Journey Shapes You" Slogan Shirt',
    category: 'Shirts',
    base_price: 2499,
    sub: 'Ivory & black slogan resort shirt',
    description: 'Typography meets art: "The Journey Shapes You" printed alongside ink-wash brushstrokes. Wear your philosophy.',
    image_url: '/images/products/top-13.png',
    tags: ['resort', 'slogan', 'typography', 'men'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: '"Escape the Ordinary" Slogan Shirt',
    category: 'Shirts',
    base_price: 2499,
    badge: 'New In',
    sub: 'Ivory & black brushstroke slogan shirt',
    description: '"Escape The Ordinary" — bold lettering layered over abstract charcoal brushwork. For those who dress with intention.',
    image_url: '/images/products/top-14.png',
    tags: ['resort', 'slogan', 'typography', 'men'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: '"Escape" Mountain Print Shirt',
    category: 'Shirts',
    base_price: 2599,
    sub: 'Ivory resort shirt with mountain & globe motifs',
    description: 'Mountains, a globe and "Wander. Explore. Discover." printed in editorial typography. The wanderer\'s uniform.',
    image_url: '/images/products/top-15.png',
    tags: ['resort', 'travel', 'mountain', 'men'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: 'Soft Days Tropical Resort Shirt',
    category: 'Shirts',
    base_price: 1999,
    badge: 'New In',
    sub: 'Cream palm & wave print women\'s resort shirt',
    description: '"Soft days. Wild heart. Clear mind." printed over ocean waves and palm trees. Linen-blend, oversized fit for effortless coastal dressing.',
    image_url: '/images/products/top-16.png',
    tags: ['resort', 'tropical', 'slogan', 'women'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Salt Water Heals Palm Shirt',
    category: 'Shirts',
    base_price: 1999,
    sub: 'Blush pink palm print women\'s resort shirt',
    description: '"Salt water heals everything" — embroidered-style palm trees and waves on the softest blush pink. The beach called, it wants this shirt back.',
    image_url: '/images/products/top-17.png',
    tags: ['resort', 'pink', 'palm', 'women'],
    sizes: variants(SIZES_WOMEN),
  },

  // ── CO-ORDS ────────────────────────────────────────────────────────────────
  {
    name: 'Beige Stripe Shirt & Wide-Leg Co-ord',
    category: 'Co-ords',
    base_price: 3499,
    badge: 'New In',
    sub: 'Vertical-stripe crop shirt & pants set',
    description: 'Tonal beige and cream vertical stripes on a matching crop button shirt and wide-leg pants. Linen-blend for all-day breathability.',
    image_url: '/images/products/coord-1.png',
    tags: ['co-ord', 'stripe', 'linen', 'women'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Sage Floral Crop Shirt Co-ord',
    category: 'Co-ords',
    base_price: 3799,
    badge: 'New In',
    sub: 'Sage green floral shirt & wide-leg pants',
    description: 'Delicate cream florals scattered across sage green. The crop button shirt and matching wide-leg pants create a relaxed, polished look.',
    image_url: '/images/products/coord-2.png',
    tags: ['co-ord', 'floral', 'sage', 'women'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Blue Tropical Toile Co-ord',
    category: 'Co-ords',
    base_price: 3999,
    sub: 'Ivory & blue tropical print shirt & pants set',
    description: 'Classic toile-de-jouy reimagined in tropical motifs — palm trees and botanicals in navy blue on ivory. A statement set with resort energy.',
    image_url: '/images/products/coord-3.png',
    tags: ['co-ord', 'toile', 'tropical', 'women'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Ivory Floral Shirt & Pants Set',
    category: 'Co-ords',
    base_price: 3799,
    sale_price: 2999,
    badge: 'Sale',
    sub: 'Blush floral wide-leg co-ord',
    description: 'Soft pink and green florals on ivory — the matching shirt and wide-leg pants look effortlessly put together with minimal effort.',
    image_url: '/images/products/coord-4.png',
    tags: ['co-ord', 'floral', 'ivory', 'women'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Dark Green Geometric Co-ord',
    category: 'Co-ords',
    base_price: 4299,
    badge: 'New In',
    sub: 'Abstract dark green & ivory print set',
    description: 'Bold abstract shapes in forest green and ivory on a luxe crepe fabric. The wide silhouette belt-tie waist adds definition to the relaxed cut.',
    image_url: '/images/products/coord-5.png',
    tags: ['co-ord', 'geometric', 'green', 'women'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Blush Satin Pyjama Co-ord',
    category: 'Co-ords',
    base_price: 3299,
    sub: 'Pink satin button shirt & wide-leg pants',
    description: 'Blush pink satin with contrasting black piping on the collar and cuffs — elevated pyjama dressing for day-to-night transitions.',
    image_url: '/images/products/coord-6.png',
    tags: ['co-ord', 'satin', 'pink', 'women', 'pyjama-style'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Olive Linen Polo & Shorts Co-ord',
    category: 'Co-ords',
    base_price: 3199,
    badge: 'New In',
    sub: 'Olive green linen polo & shorts set for men',
    description: 'Matching olive green linen-blend camp polo and drawstring shorts. The go-to summer set for men who hate overthinking outfits.',
    image_url: '/images/products/coord-7.png',
    tags: ['co-ord', 'linen', 'olive', 'men', 'shorts'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: 'Sage Tee & Cream Shorts Co-ord',
    category: 'Co-ords',
    base_price: 2799,
    sub: 'Sage green tee & cream drawstring shorts',
    description: 'Tonal two-piece in relaxed cotton — sage green logo tee paired with cream drawstring shorts. Minimal, clean, done.',
    image_url: '/images/products/coord-8.png',
    tags: ['co-ord', 'casual', 'tee', 'men', 'shorts'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: 'Abstract Brushstroke Shirt & Shorts',
    category: 'Co-ords',
    base_price: 3499,
    badge: 'New In',
    sub: 'Ivory & navy brushstroke print resort set',
    description: 'Navy and olive abstract brushstrokes on ivory. The short-sleeve shirt and matching shorts are the only outfit you need poolside.',
    image_url: '/images/products/coord-9.png',
    tags: ['co-ord', 'resort', 'brushstroke', 'men', 'shorts'],
    sizes: variants(SIZES_MEN),
  },

  // ── BOTTOMS ────────────────────────────────────────────────────────────────
  {
    name: 'Olive Wide-Leg Cargo Pants',
    category: 'Bottoms',
    base_price: 2199,
    badge: 'New In',
    sub: 'Olive green utility cargo trousers',
    description: 'Relaxed wide-leg silhouette with side cargo pockets in olive green cotton twill. Equal parts utility and style.',
    image_url: '/images/products/bottom-1.png',
    tags: ['cargo', 'wide-leg', 'olive', 'women'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Beige Pleated Wide-Leg Trousers',
    category: 'Bottoms',
    base_price: 2499,
    sub: 'Sand beige tailored wide-leg trousers',
    description: 'Double front pleats and a high waist in a warm sand beige. Fluid fabric drapes beautifully — office to evening without a change.',
    image_url: '/images/products/bottom-2.png',
    tags: ['trousers', 'pleated', 'beige', 'women', 'tailored'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Striped Linen Drawstring Pants',
    category: 'Bottoms',
    base_price: 2299,
    badge: 'New In',
    sub: 'Blue & white stripe wide-leg linen trousers',
    description: 'Blue, white and ecru vertical stripes in a relaxed wide-leg linen cut with elasticated drawstring waist. Summer in pant form.',
    image_url: '/images/products/bottom-3.png',
    tags: ['linen', 'stripe', 'drawstring', 'men', 'wide-leg'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: 'Ivory Pinstripe Drawstring Trousers',
    category: 'Bottoms',
    base_price: 2599,
    sub: 'Ivory & black pinstripe relaxed trousers',
    description: 'Classic black-on-ivory pinstripe in a fluid wide-leg cut with drawstring waist — dressier than joggers, more relaxed than tailoring.',
    image_url: '/images/products/bottom-4.png',
    tags: ['pinstripe', 'drawstring', 'ivory', 'men'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: 'Grey Pinstripe Pleated Trousers',
    category: 'Bottoms',
    base_price: 2799,
    sale_price: 2099,
    badge: 'Sale',
    sub: 'Ivory & grey pinstripe wide-leg pleated pants',
    description: 'Double-pleated front with a wide-leg break. Ivory ground with fine grey pinstripes — a modern take on the classic tailored trouser.',
    image_url: '/images/products/bottom-5.png',
    tags: ['pinstripe', 'pleated', 'grey', 'men', 'tailored'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: 'Chocolate Cargo Wide-Leg Pants',
    category: 'Bottoms',
    base_price: 2299,
    sub: 'Chocolate brown utility cargo pants',
    description: 'Washed chocolate brown cargo pants in a relaxed wide-leg fit. Deep side pockets and elasticated waist for all-day ease.',
    image_url: '/images/products/bottom-6.png',
    tags: ['cargo', 'wide-leg', 'brown', 'men'],
    sizes: variants(SIZES_MEN),
  },
  {
    name: 'Wide-Leg Boyfriend Jeans',
    category: 'Bottoms',
    base_price: 2999,
    badge: 'New In',
    sub: 'Light blue washed wide-leg jeans',
    description: 'Low-rise with a voluminous wide-leg silhouette in light blue washed denim. Worn-in creases and a relaxed waist — the new denim essential.',
    image_url: '/images/products/bottom-7.png',
    tags: ['jeans', 'wide-leg', 'denim', 'women'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Khaki Washed Jogger Pants',
    category: 'Bottoms',
    base_price: 1799,
    sale_price: 1299,
    badge: 'Sale',
    sub: 'Khaki garment-washed joggers with cuffed hem',
    description: 'Garment-washed for a soft, broken-in feel. Elastic waist, tapered leg and ribbed cuffed hem in a warm khaki tone.',
    image_url: '/images/products/bottom-8.png',
    tags: ['joggers', 'khaki', 'washed', 'men'],
    sizes: variants(SIZES_MEN),
  },

  // ── DRESSES ────────────────────────────────────────────────────────────────
  {
    name: 'Navy Belted Collared Jumpsuit',
    category: 'Dresses',
    base_price: 3299,
    badge: 'New In',
    sub: 'Navy short-sleeve belted wide-leg jumpsuit',
    description: 'Structured short-sleeve jumpsuit with a collared neckline and self-belt at the waist. Navy blue cotton-blend that keeps its shape all day.',
    image_url: '/images/products/dress-1.png',
    tags: ['jumpsuit', 'navy', 'belted', 'unisex'],
    sizes: variants(SIZES_UNISEX),
  },
  {
    name: 'Light Wash Denim Dungarees',
    category: 'Dresses',
    base_price: 3499,
    sub: 'Wide-leg light wash denim overalls',
    description: 'Relaxed wide-leg dungarees in light-wash denim. Adjustable straps and side pockets — functional, casual and endlessly wearable.',
    image_url: '/images/products/dress-2.png',
    tags: ['dungarees', 'denim', 'overalls', 'women'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Ivory Belted Sleeveless Jumpsuit',
    category: 'Dresses',
    base_price: 3799,
    badge: 'New In',
    sub: 'Cream lapel wide-leg belted jumpsuit',
    description: 'Sleeveless wide-leg jumpsuit with notched lapels and a waist-defining self-belt in ivory crepe. Effortlessly polished.',
    image_url: '/images/products/dress-3.png',
    tags: ['jumpsuit', 'ivory', 'belted', 'sleeveless', 'women'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Ivory Spaghetti Strap Midi Dress',
    category: 'Dresses',
    base_price: 2799,
    sub: 'Ivory A-line midi slip dress',
    description: 'Delicate spaghetti straps and a flowing A-line silhouette in ivory. The dress that works for every occasion you can\'t decide what to wear to.',
    image_url: '/images/products/dress-4.png',
    tags: ['midi', 'slip', 'ivory', 'women', 'strappy'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Chocolate Bodycon Maxi Dress',
    category: 'Dresses',
    base_price: 2999,
    sale_price: 2299,
    badge: 'Sale',
    sub: 'Chocolate brown spaghetti-strap maxi',
    description: 'A sleek bodycon silhouette in rich chocolate brown with thin spaghetti straps. Matte jersey that sculpts without constricting.',
    image_url: '/images/products/dress-5.png',
    tags: ['maxi', 'bodycon', 'brown', 'women'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Ivory Floral Cutout Maxi Dress',
    category: 'Dresses',
    base_price: 3499,
    badge: 'New In',
    sub: 'Ivory maxi with blue floral print & waist cutout',
    description: 'Romantic blue florals on ivory with a subtle waist cutout detail. Floor-length with a flowing skirt — the dress you\'ll wear all summer.',
    image_url: '/images/products/dress-6.png',
    tags: ['maxi', 'floral', 'cutout', 'ivory', 'women'],
    sizes: variants(SIZES_WOMEN),
  },
  {
    name: 'Ivory Collared Button-Down Mini',
    category: 'Dresses',
    base_price: 2499,
    sub: 'Ivory sleeveless shirt-dress mini',
    description: 'Sleeveless shirt-dress silhouette with a pointed collar and full button placket. Clean ivory with a structured shape that always looks intentional.',
    image_url: '/images/products/dress-7.png',
    tags: ['mini', 'shirt-dress', 'ivory', 'women', 'sleeveless'],
    sizes: variants(SIZES_WOMEN),
  },
];

async function seed() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Clear dependent data before deleting products
    await client.query('DELETE FROM order_items');
    await client.query('DELETE FROM cart_items');
    await client.query('DELETE FROM product_variants');
    await client.query('DELETE FROM products');
    console.log('Cleared existing products.');

    let count = 0;
    for (const p of products) {
      const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        + '-' + (count + 1);
      const skuPrefix = 'HWT-' + p.category.toUpperCase().slice(0, 3).replace(/[^A-Z]/g, 'X')
        + '-' + String(100 + count).padStart(3, '0');

      const pRes = await client.query(
        `INSERT INTO products
           (name, slug, description, category, sku_prefix, base_price, sale_price,
            image_url, badge, sub, tags, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE)
         RETURNING id`,
        [
          p.name, slug, p.description, p.category, skuPrefix,
          p.base_price,
          p.sale_price || null,
          p.image_url,
          p.badge || null,
          p.sub || '',
          p.tags || [],
        ]
      );
      const productId = pRes.rows[0].id;

      for (const s of p.sizes) {
        const sku = skuPrefix + '-' + s.size.replace(/\s/g, '');
        await client.query(
          `INSERT INTO product_variants (product_id, size, sku, stock_qty)
           VALUES ($1,$2,$3,$4)`,
          [productId, s.size, sku, s.stock_qty]
        );
      }

      count++;
      console.log(`  [${count}/${products.length}] ${p.name}`);
    }

    await client.query('COMMIT');
    console.log(`\nSeeded ${count} products successfully.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
