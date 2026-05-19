#!/usr/bin/env ts-node

import dotenv from 'dotenv'

async function setupResend() {
  console.log('=== Resend API Setup ===\n')

  if (!process.env.RESEND_API_KEY) {
    console.log('No RESEND_API_KEY found in environment variables.')
    console.log('Please add a valid Resend API key to your .env.local file first.')
    console.log('You can get one from: https://resend.com/api-keys')
    process.exit(1)
  }

  console.log('RESEND_API_KEY is configured!')
  console.log('\n=== Setup Complete ===')
  console.log('You can now:')
  console.log('1. Test emails in development with MailHog (http://localhost:8025)')
  console.log('2. Use Resend in production with your API key')
}

if (require.main === module) {
  dotenv.config({ path: '.env.local' })
  setupResend().catch(console.error)
}
