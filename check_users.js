const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true
    }
  });
  
  console.log('\n=== 최근 가입 회원 (20명) ===\n');
  users.forEach((user, index) => {
    const date = new Date(user.createdAt).toLocaleString('ko-KR');
    console.log(`${index + 1}. ${user.name} (${user.email})`);
    console.log(`   권한: ${user.role} | 가입일: ${date}\n`);
  });
  
  console.log(`총 회원 수: ${users.length}명\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
