require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  try {
    const result = await prisma.subscription.updateMany({
      where: {
        plan: { in: ['starter', 'pro'] },
      },
      data: {
        planChangeDate: new Date(),
      },
    });
    console.log(`Updated ${result.count} subscriptions`);
  } catch(e) {
    console.log('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();