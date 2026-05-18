import Stripe from 'stripe';
import { writeFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const CURRENCY = process.env.STRIPE_CURRENCY || 'eur';

async function createProducts() {
  console.log(`Creating Stripe products in ${CURRENCY.toUpperCase()}...`);

  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('STRIPE_SECRET_KEY not found. Skipping product creation.');
    console.log('Add STRIPE_SECRET_KEY to .env.local to create products.');
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-03-25.dahlia',
  });

  const formatAmount = (amount: number) => CURRENCY === 'eur' ? amount : amount * 100;

  const starterMonthly = await stripe.products.create({
    name: 'Omnysync Starter',
    description: '20 prompts/month, 5 templates, basic scorer',
  });

  const starterMonthlyPrice = await stripe.prices.create({
    product: starterMonthly.id,
    unit_amount: CURRENCY === 'eur' ? 800 : 800,
    currency: CURRENCY,
    recurring: {
      interval: 'month',
    },
    metadata: {
      tier: 'omnysync_starter',
      interval: 'monthly',
    },
  });

  console.log(`Created Starter Monthly: ${starterMonthlyPrice.id}`);

  const proMonthly = await stripe.products.create({
    name: 'Omnysync Pro',
    description: '300 prompts/month, unlimited templates, all modes, advanced scorer',
  });

  const proMonthlyPrice = await stripe.prices.create({
    product: proMonthly.id,
    unit_amount: CURRENCY === 'eur' ? 2000 : 2000,
    currency: CURRENCY,
    recurring: {
      interval: 'month',
    },
    metadata: {
      tier: 'omnysync_pro',
      interval: 'monthly',
    },
  });

  console.log(`Created Pro Monthly: ${proMonthlyPrice.id}`);

  const envContent = `# Stripe Price IDs (generated ${new Date().toISOString()})
STRIPE_PRICE_STARTER_MONTHLY=${starterMonthlyPrice.id}
STRIPE_PRICE_PRO_MONTHLY=${proMonthlyPrice.id}
`;

  writeFileSync('.env.local', envContent, { flag: 'a' });
  console.log('\n✅ All products created!');
  console.log('\nPrice IDs added to .env.local:');
  console.log(`STRIPE_PRICE_STARTER_MONTHLY=${starterMonthlyPrice.id}`);
  console.log(`STRIPE_PRICE_PRO_MONTHLY=${proMonthlyPrice.id}`);
}

createProducts().catch(console.error);