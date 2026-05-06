const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000';

const tests = [
  {
    name: 'Welcome (Pro)',
    endpoint: '/api/auth/welcome',
    body: { email: 'test@example.com', name: 'Jean', plan: 'pro', amount: '19', lang: 'fr' }
  },
  {
    name: 'Welcome (Starter)',
    endpoint: '/api/auth/welcome',
    body: { email: 'test@example.com', name: 'Marie', plan: 'starter', amount: '9', lang: 'fr' }
  }
];

async function sendTestEmail(test) {
  try {
    const response = await fetch(`${API_URL}${test.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test.body)
    });
    const data = await response.json();
    console.log(`✅ ${test.name}:`, data);
  } catch (error) {
    console.log(`❌ ${test.name}:`, error.message);
  }
}

async function run() {
  console.log('📧 Envoi des emails de test...\n');
  
  for (const test of tests) {
    await sendTestEmail(test);
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n📬 Vérifie MailHog: http://localhost:8025');
}

run();