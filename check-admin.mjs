import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdmin() {
  try {
    console.log('🔍 Checking admin accounts...\n');
    
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
        createdAt: true
      }
    });

    console.log('📊 Admin Accounts Found:', admins.length);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    admins.forEach((admin, index) => {
      console.log(`\n👤 Admin #${index + 1}:`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Name: ${admin.name}`);
      console.log(`   Password: ${admin.password}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Created: ${admin.createdAt}`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Login Credentials:');
    if (admins.length > 0) {
      console.log(`   Email: ${admins[0].email}`);
      console.log(`   Password: ${admins[0].password}`);
    } else {
      console.log('   ❌ No admin account found!');
    }
    
    // Also check partner accounts
    console.log('\n\n🔍 Checking partner accounts...\n');
    const partners = await prisma.user.findMany({
      where: { role: 'PARTNER' },
      select: {
        email: true,
        name: true,
        password: true
      }
    });

    console.log('📊 Partner Accounts Found:', partners.length);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    partners.forEach((partner, index) => {
      console.log(`\n👤 Partner #${index + 1}:`);
      console.log(`   Email: ${partner.email}`);
      console.log(`   Name: ${partner.name}`);
      console.log(`   Password: ${partner.password}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmin();
