const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@contentfactory.com' },
    update: {},
    create: {
      email: 'admin@contentfactory.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  console.log('✅ Created admin user:', adminUser.email);

  // Create default workspace for admin
  const defaultWorkspace = await prisma.workspace.upsert({
    where: { slug: 'default-workspace' },
    update: {},
    create: {
      name: 'Default Workspace',
      slug: 'default-workspace',
      description: 'Default workspace for getting started',
      ownerId: adminUser.id,
      plan: 'PRO',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Created default workspace:', defaultWorkspace.name);

  // Add admin as workspace member
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: defaultWorkspace.id,
        userId: adminUser.id,
      },
    },
    update: {},
    create: {
      workspaceId: defaultWorkspace.id,
      userId: adminUser.id,
      role: 'OWNER',
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
  });

  console.log('✅ Added admin to workspace');
  console.log('🎉 Database seeded successfully!');
  console.log('\n📋 Login Credentials:');
  console.log('   Email: admin@contentfactory.com');
  console.log('   Password: admin123');
  console.log('\n⚠️  Remember to change the admin password after first login!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });