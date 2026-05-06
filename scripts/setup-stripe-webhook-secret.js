#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Setting up Stripe webhook secret...\n');

function checkStripeCLI() {
  try {
    execSync('stripe --version', { stdio: 'pipe' });
    console.log('✅ Stripe CLI is installed');
    
    execSync('stripe config --list', { stdio: 'pipe' });
    console.log('✅ Stripe CLI is logged in');
    return true;
  } catch (error) {
    console.error('❌ Stripe CLI is not installed or not logged in');
    console.log('Please run: npm run stripe:setup');
    return false;
  }
}

function createWebhookEndpoint() {
  try {
    console.log('Creating webhook endpoint for development...');
    
    const result = execSync('stripe listen --forward-to localhost:3000/api/stripe/webhook --device-name "Omnysync Development"', {
      encoding: 'utf8',
      timeout: 5000
    });
    
    const match = result.match(/whsec_[a-zA-Z0-9]+/);
    if (match) {
      return match[0];
    }
    
    return null;
  } catch (error) {
    if (error.stdout) {
      const match = error.stdout.match(/whsec_[a-zA-Z0-9]+/);
      if (match) {
        return match[0];
      }
    }
    return null;
  }
}

function updateEnvFile(webhookSecret) {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    let content = fs.readFileSync(envPath, 'utf8');
    
    content = content.replace(
      /STRIPE_WEBHOOK_SECRET=".*?"/,
      `STRIPE_WEBHOOK_SECRET="${webhookSecret}"`
    );
    
    fs.writeFileSync(envPath, content);
    console.log('✅ Updated .env.local with webhook secret');
    return true;
  } catch (error) {
    console.error('❌ Failed to update .env.local:', error.message);
    return false;
  }
}

function getExistingWebhookSecret() {
  try {
    console.log('Checking for existing webhook endpoint...');
    
    const result = execSync('stripe listen --forward-to localhost:3000/api/stripe/webhook --device-name "Omnysync Development"', {
      encoding: 'utf8',
      timeout: 3000
    });
    
    const match = result.match(/whsec_[a-zA-Z0-9]+/);
    if (match) {
      console.log('✅ Found existing webhook endpoint');
      return match[0];
    }
    
    return null;
  } catch (error) {
    if (error.stdout) {
      const match = error.stdout.match(/whsec_[a-zA-Z0-9]+/);
      if (match) {
        console.log('✅ Found existing webhook endpoint');
        return match[0];
      }
    }
    return null;
  }
}

async function main() {
  console.log('🔧 Setting up Stripe Webhook Secret for Omnysync\n');

  if (!checkStripeCLI()) {
    process.exit(1);
  }

  let webhookSecret = getExistingWebhookSecret();
  
  if (!webhookSecret) {
    console.log('Creating new webhook endpoint...');
    webhookSecret = createWebhookEndpoint();
  }

  if (!webhookSecret) {
    console.error('❌ Could not obtain webhook secret');
    console.log('Please make sure Stripe CLI is properly configured');
    process.exit(1);
  }

  if (updateEnvFile(webhookSecret)) {
    console.log('\n🎉 Stripe webhook setup complete!');
    console.log('\nWebhook Details:');
    console.log('• Endpoint: http://localhost:3000/api/stripe/webhook');
    console.log('• Secret:', webhookSecret);
    console.log('• Device: Omnysync Development');
    
    console.log('\nNext steps:');
    console.log('1. Start webhook forwarding: npm run stripe:setup');
    console.log('2. Test webhooks: npm run stripe:test');
    console.log('3. Check emails in MailHog: http://localhost:8025');
  } else {
    process.exit(1);
  }
}

main();