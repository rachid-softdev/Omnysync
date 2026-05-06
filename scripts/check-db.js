require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  try {
    const result = await prisma.$queryRaw`DESC \`Subscription\``;
    console.log('Columns:', result.map(r => r.Field));
  } catch(e) {
    console.log('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();