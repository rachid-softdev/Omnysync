require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  try {
    const columns = await prisma.$queryRaw`DESCRIBE \`Chain\``;
    const hasConnections = columns.some(c => c.Field === 'connections');
    
    if (!hasConnections) {
      await prisma.$queryRaw`ALTER TABLE Chain ADD COLUMN connections TEXT`;
      console.log('Added connections column');
    } else {
      console.log('Column already exists');
    }
    
    const hasUpdatedAt = columns.some(c => c.Field === 'updatedAt');
    if (!hasUpdatedAt) {
      await prisma.$queryRaw`ALTER TABLE Chain ADD COLUMN updatedAt DATETIME`;
      console.log('Added updatedAt column');
    }
  } catch(e) {
    console.log('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();