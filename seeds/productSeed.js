const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product');
const Business = require('../models/Business');

dotenv.config();

const sampleProducts = [
  {
    name: 'Fresh Whole Milk 1L',
    description: 'Farm-fresh full-fat whole milk, pasteurized and homogenized. Perfect for daily use.',
    price: 180,
    category: 'Groceries',
    stockQty: 50,
    status: 'active',
    images: [],
  },
  {
    name: 'Brown Eggs (12 pack)',
    description: 'Free-range brown eggs, naturally raised. Rich in protein and nutrients.',
    price: 320,
    category: 'Groceries',
    stockQty: 30,
    status: 'active',
    images: [],
  },
  {
    name: 'Basmati Rice 5kg',
    description: 'Premium long-grain basmati rice. Aged for extra fragrance and fluffy texture.',
    price: 950,
    category: 'Groceries',
    stockQty: 100,
    status: 'active',
    images: [],
  },
  {
    name: 'Sunflower Cooking Oil 1L',
    description: 'Light and healthy sunflower oil, ideal for frying, baking, and salad dressing.',
    price: 450,
    category: 'Groceries',
    stockQty: 60,
    status: 'active',
    images: [],
  },
  {
    name: 'Chicken Breast (500g)',
    description: 'Boneless, skinless chicken breast. Lean, high-protein, and farm-raised.',
    price: 560,
    category: 'Groceries',
    stockQty: 25,
    status: 'active',
    images: [],
  },
  {
    name: 'Whole Wheat Bread',
    description: 'Freshly baked whole wheat bread loaf. No preservatives, made daily.',
    price: 130,
    category: 'Groceries',
    stockQty: 20,
    status: 'active',
    images: [],
  },
  {
    name: 'Organic Bananas (6 pcs)',
    description: 'Naturally ripened organic bananas. Sweet, rich in potassium and fiber.',
    price: 120,
    category: 'Groceries',
    stockQty: 40,
    status: 'active',
    images: [],
  },
  {
    name: 'Tomatoes (1kg)',
    description: 'Fresh vine-ripened tomatoes. Great for curries, salads, and sauces.',
    price: 90,
    category: 'Groceries',
    stockQty: 45,
    status: 'active',
    images: [],
  },
  {
    name: 'Desi Ghee 500g',
    description: 'Pure desi ghee made from grass-fed cow milk. Traditional taste, zero additives.',
    price: 1100,
    category: 'Groceries',
    stockQty: 15,
    status: 'active',
    images: [],
  },
  {
    name: 'Mixed Spice Pack',
    description: 'Curated pack of 6 essential spices: turmeric, cumin, coriander, chili, garam masala, and cardamom.',
    price: 350,
    category: 'Groceries',
    stockQty: 35,
    status: 'active',
    images: [],
  },
];

const seedProducts = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const businessId = '69f637888819d92849897832';
    console.log(`📦 Seeding products for business: ${businessId}`);

    let created = 0;
    let skipped = 0;

    for (const productData of sampleProducts) {
      const exists = await Product.findOne({ name: productData.name, business: businessId });
      if (exists) {
        console.log(`  ⏭️  Already exists: ${productData.name}`);
        skipped++;
        continue;
      }
      await Product.create({ ...productData, business: businessId });
      console.log(`  ✅ Created: ${productData.name}`);
      created++;
    }

    console.log(`\n🎉 Done! ${created} products created, ${skipped} skipped.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seedProducts();
