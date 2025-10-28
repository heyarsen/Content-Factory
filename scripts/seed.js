import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  
  try {
    // Create demo user
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const user = await prisma.user.upsert({
      where: { email: 'demo@contentfactory.com' },
      update: {},
      create: {
        email: 'demo@contentfactory.com',
        username: 'demo',
        firstName: 'Demo',
        lastName: 'User',
        password: hashedPassword,
        emailVerified: true
      }
    });
    
    // Create demo workspace
    const workspace = await prisma.workspace.upsert({
      where: { slug: 'demo-workspace' },
      update: {},
      create: {
        name: 'Demo Workspace',
        slug: 'demo-workspace',
        description: 'A demo workspace for Content Factory',
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
            status: 'ACTIVE',
            joinedAt: new Date()
          }
        }
      }
    });
    
    // Create sample videos
    const videos = await Promise.all([
      prisma.video.create({
        data: {
          title: 'Welcome to Content Factory',
          description: 'An introduction to our AI-powered video platform',
          topic: 'Welcome message for new users explaining platform features',
          style: 'PROFESSIONAL',
          duration: 60,
          status: 'COMPLETED',
          videoUrl: 'https://example.com/video1.mp4',
          thumbnailUrl: 'https://example.com/thumb1.jpg',
          workspaceId: workspace.id,
          userId: user.id,
          publishedAt: new Date()
        }
      }),
      prisma.video.create({
        data: {
          title: 'Social Media Marketing Tips',
          description: 'Essential tips for effective social media marketing',
          topic: 'Top 5 social media marketing strategies for small businesses',
          style: 'ENERGETIC',
          duration: 90,
          status: 'COMPLETED',
          videoUrl: 'https://example.com/video2.mp4',
          thumbnailUrl: 'https://example.com/thumb2.jpg',
          workspaceId: workspace.id,
          userId: user.id,
          publishedAt: new Date()
        }
      })
    ]);
    
    // Create sample analytics data
    for (const video of videos) {
      const dates = [];
      for (let i = 7; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date);
      }
      
      for (const date of dates) {
        await prisma.videoAnalytics.create({
          data: {
            videoId: video.id,
            date,
            views: Math.floor(Math.random() * 1000) + 100,
            likes: Math.floor(Math.random() * 100) + 10,
            comments: Math.floor(Math.random() * 20) + 2,
            shares: Math.floor(Math.random() * 50) + 5,
            reach: Math.floor(Math.random() * 1500) + 200
          }
        });
      }
    }
    
    // Create sample calendar events
    await prisma.calendarEvent.createMany({
      data: [
        {
          title: 'Weekly Content Planning',
          description: 'Plan content for the upcoming week',
          startDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
          endDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
          type: 'MEETING',
          workspaceId: workspace.id
        },
        {
          title: 'Instagram Post - Marketing Tips',
          description: 'Post the marketing tips video to Instagram',
          startDate: new Date(new Date().getTime() + 2 * 24 * 60 * 60 * 1000),
          endDate: new Date(new Date().getTime() + 2 * 24 * 60 * 60 * 1000),
          allDay: true,
          type: 'POST_SCHEDULE',
          workspaceId: workspace.id
        }
      ]
    });
    
    console.log('✅ Seeding completed successfully!');
    console.log('📧 Demo user credentials:');
    console.log('   Email: demo@contentfactory.com');
    console.log('   Password: password123');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });