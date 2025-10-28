# Content Factory 2.0

🚀 **AI-Powered Content Creation & Team Collaboration Platform**

A modern, full-stack application for creating AI-generated videos, managing content calendars, team collaboration, and comprehensive analytics.

## ✨ Features

### 🎥 **Video Generation**
- AI-powered video creation with HeyGen integration
- Multiple styles: Casual, Professional, Energetic, Educational
- Real-time generation status tracking
- Automatic thumbnail generation

### 📊 **Analytics Dashboard**
- Real-time performance metrics across all platforms
- Interactive charts and data visualization
- Export capabilities (CSV, PDF reports)
- Custom KPIs and engagement tracking

### 📅 **Content Calendar & Planning**
- Visual drag-and-drop content scheduling
- AI-suggested optimal posting times
- Bulk operations and content templates
- Multi-platform publishing automation

### 👥 **Team Collaboration**
- Role-based access control (Owner, Admin, Editor, Member, Viewer)
- Real-time comments and approval workflows
- Shared asset library with version control
- Activity tracking and audit logs

### 🎨 **Modern UI/UX**
- Dark/Light theme support
- Responsive design for all devices
- Progressive Web App (PWA) capabilities
- Intuitive navigation and user experience

### 🔐 **Enterprise Security**
- JWT-based authentication
- Role-based permissions
- Session management
- Audit logging

## 🛠️ Tech Stack

**Frontend:**
- React 18 with Vite
- Tailwind CSS for styling
- Zustand for state management
- Recharts for analytics visualization
- React Big Calendar for scheduling
- Framer Motion for animations

**Backend:**
- Node.js with Express
- Prisma ORM with PostgreSQL
- JWT authentication
- Socket.io for real-time features
- Winston for logging
- Node-cron for scheduled tasks

**Integrations:**
- HeyGen API for AI video generation
- UploadPost.com for social media publishing
- Email notifications (SMTP)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- API keys for HeyGen and UploadPost

### Installation

1. **Clone and install dependencies:**
```bash
git clone <your-repo>
cd Content-Factory
npm install
```

2. **Environment setup:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Database setup:**
```bash
npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed  # Optional: seed with sample data
```

4. **Start development servers:**
```bash
npm run dev  # Starts both frontend and backend
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📁 Project Structure

```
Content-Factory/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
├── src/
│   ├── components/        # React components
│   ├── pages/            # Application pages
│   ├── hooks/            # Custom React hooks
│   ├── store/            # Zustand stores
│   ├── utils/            # Utility functions
│   └── server/           # Backend API routes & middleware
├── public/               # Static assets
├── dist/                 # Production build
└── logs/                 # Application logs
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `JWT_SECRET` | Secret for JWT token signing | ✅ |
| `HEYGEN_KEY` | HeyGen API key | ✅ |
| `UPLOADPOST_KEY` | UploadPost API key | ✅ |
| `FRONTEND_URL` | Frontend application URL | ✅ |
| `PORT` | Server port (default: 4000) | ❌ |
| `NODE_ENV` | Environment mode | ❌ |

### Database Schema

The application uses Prisma ORM with PostgreSQL. Key models include:
- **User** - User accounts and profiles
- **Workspace** - Team/organization workspaces
- **Video** - AI-generated video content
- **Post** - Social media posts and scheduling
- **Analytics** - Performance metrics and tracking
- **CalendarEvent** - Content planning and scheduling

## 📊 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Token verification

### Video Management
- `GET /api/videos/workspace/:id` - List workspace videos
- `POST /api/videos` - Create new video
- `GET /api/videos/:id` - Get video details
- `GET /api/videos/:id/status` - Check generation status
- `PUT /api/videos/:id` - Update video
- `DELETE /api/videos/:id` - Archive video

### Analytics
- `GET /api/analytics/workspace/:id/overview` - Analytics overview
- `GET /api/analytics/video/:id` - Video-specific analytics
- `GET /api/analytics/workspace/:id/trends` - Analytics trends
- `GET /api/analytics/workspace/:id/export` - Export data

### Workspace Management
- `GET /api/workspaces` - List user workspaces
- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces/:id` - Get workspace details
- `POST /api/workspaces/:id/invite` - Invite team member
- `PUT /api/workspaces/:id/members/:userId/role` - Update member role

## 🚀 Deployment

### Railway (Recommended)

1. **Connect repository to Railway**
2. **Set environment variables in Railway dashboard**
3. **Deploy automatically with git push**

### Docker

```bash
# Build image
docker build -t content-factory .

# Run container
docker run -p 4000:4000 --env-file .env content-factory
```

### Manual Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🔍 Development

### Available Scripts

- `npm run dev` - Start development servers (frontend + backend)
- `npm run client:dev` - Start only frontend development server
- `npm run server:dev` - Start only backend development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database with sample data

### Code Style

- ESLint and Prettier for code formatting
- Conventional commits for git messages
- Component-based architecture
- Custom hooks for business logic

## 📈 Performance

- **Lazy loading** for route components
- **Image optimization** with Sharp
- **Database indexing** for query performance
- **Caching** for frequently accessed data
- **Rate limiting** for API protection

## 🔐 Security Features

- **JWT authentication** with secure session management
- **Password hashing** with bcryptjs
- **Rate limiting** to prevent abuse
- **Input validation** with Joi
- **CORS protection** for cross-origin requests
- **Helmet.js** for security headers

## 🐛 Troubleshooting

### Common Issues

1. **Database connection failed**
   - Verify PostgreSQL is running
   - Check DATABASE_URL format
   - Run migrations: `npx prisma migrate dev`

2. **API key errors**
   - Verify HeyGen and UploadPost API keys
   - Check key permissions and quotas
   - Ensure keys are set in environment variables

3. **Build failures**
   - Clear node_modules and reinstall
   - Check Node.js version compatibility
   - Verify all environment variables are set

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- [HeyGen API Documentation](https://docs.heygen.com)
- [UploadPost API Documentation](https://upload-post.com/docs)
- [Prisma Documentation](https://prisma.io/docs)
- [Railway Deployment Guide](https://railway.app/docs)

---

**Built with ❤️ for modern content creators and teams**