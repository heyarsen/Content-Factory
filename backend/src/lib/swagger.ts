/**
 * Swagger / OpenAPI 3.0 documentation setup.
 *
 * Access the interactive docs at: GET /api/docs
 * Access the raw spec at:        GET /api/docs/spec.json
 *
 * To add documentation to a route, use JSDoc comments with @swagger tag.
 * See examples in routes/credits.ts and routes/plans.ts.
 */

import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import type { Express } from 'express'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI-SMM Content Factory API',
      version: '1.0.0',
      description: `
## AI-SMM Content Factory Backend API

This API powers the AI-SMM platform — an automated social media content generation service.

### Authentication

Most endpoints require a valid Supabase JWT token passed as a Bearer token in the \`Authorization\` header:

\`\`\`
Authorization: Bearer <supabase_jwt_token>
\`\`\`

### Rate Limiting

The API applies rate limiting per IP address. Exceeding the limit returns \`429 Too Many Requests\`.

### Error Format

All errors follow a consistent format:

\`\`\`json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
\`\`\`
      `,
      contact: {
        name: 'AI-SMM Support',
        url: 'https://ai-smm.co',
        email: 'support@ai-smm.co',
      },
      license: {
        name: 'Proprietary',
      },
    },
    servers: [
      {
        url: 'https://app.ai-smm.co',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3001',
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase JWT token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Resource not found' },
            code: { type: 'string', example: 'NOT_FOUND' },
            timestamp: { type: 'string', format: 'date-time' },
          },
          required: ['error'],
        },
        PaginationParams: {
          type: 'object',
          properties: {
            limit: { type: 'integer', default: 50, minimum: 1, maximum: 200 },
            offset: { type: 'integer', default: 0, minimum: 0 },
          },
        },
        UserCredits: {
          type: 'object',
          properties: {
            credits: { type: 'number', example: 150.5 },
            userId: { type: 'string', format: 'uuid' },
          },
          required: ['credits'],
        },
        CreditTransaction: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            amount: { type: 'number', example: 10 },
            operation: { type: 'string', example: 'video_generation' },
            balance_before: { type: 'number' },
            balance_after: { type: 'number' },
            payment_status: {
              type: 'string',
              enum: ['pending', 'completed', 'failed'],
            },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        VideoPlan: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'My Content Plan' },
            videos_per_day: { type: 'integer', minimum: 1, maximum: 10 },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date', nullable: true },
            enabled: { type: 'boolean' },
            auto_research: { type: 'boolean' },
            auto_create: { type: 'boolean' },
            auto_approve: { type: 'boolean' },
            trigger_time: { type: 'string', example: '09:00' },
            timezone: { type: 'string', example: 'Europe/Kyiv' },
            default_platforms: {
              type: 'array',
              items: { type: 'string', enum: ['instagram', 'tiktok', 'youtube'] },
            },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Video: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            status: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed'],
            },
            video_url: { type: 'string', format: 'uri', nullable: true },
            duration: { type: 'number', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Avatar: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            status: {
              type: 'string',
              enum: ['pending', 'training', 'ready', 'failed'],
            },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        SubscriptionPlan: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', example: 'Pro' },
            credits_per_month: { type: 'integer' },
            price_usd: { type: 'number' },
            features: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Unauthorized', code: 'UNAUTHORIZED' },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Resource not found', code: 'NOT_FOUND' },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        RateLimitExceeded: {
          description: 'Too many requests',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
            },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication and user management' },
      { name: 'Videos', description: 'Video generation and management' },
      { name: 'Plans', description: 'Content automation plans' },
      { name: 'Avatars', description: 'AI avatar management' },
      { name: 'Credits', description: 'Credit balance and transactions' },
      { name: 'Social', description: 'Social media account connections' },
      { name: 'Posts', description: 'Scheduled posts management' },
      { name: 'Content', description: 'AI content generation' },
      { name: 'Dashboard', description: 'Dashboard statistics' },
      { name: 'Preferences', description: 'User preferences' },
      { name: 'Support', description: 'Customer support' },
      { name: 'Admin', description: 'Admin-only endpoints' },
      { name: 'Privacy', description: 'GDPR and privacy compliance' },
      { name: 'Trends', description: 'Trend research and analysis' },
      { name: 'Referrals', description: 'Referral program' },
    ],
  },
  // Scan all route files for @swagger JSDoc comments
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
}

export const swaggerSpec = swaggerJsdoc(options)

/**
 * Register Swagger UI and spec endpoint on the Express app.
 * Available at /api/docs (UI) and /api/docs/spec.json (raw spec).
 */
export function setupSwagger(app: Express): void {
  // Serve raw OpenAPI spec as JSON
  app.get('/api/docs/spec.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(swaggerSpec)
  })

  // Serve Swagger UI
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'AI-SMM API Docs',
      customCss: `
        .swagger-ui .topbar { background-color: #1a1a2e; }
        .swagger-ui .topbar .download-url-wrapper { display: none; }
      `,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
      },
    })
  )

  console.info('[Swagger] API docs available at /api/docs')
}
