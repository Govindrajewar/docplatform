import swaggerJSDoc from 'swagger-jsdoc';

const errorSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    data: { nullable: true, example: null },
    error: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          enum: [
            'VALIDATION_ERROR',
            'UNAUTHORIZED',
            'FORBIDDEN',
            'NOT_FOUND',
            'CONFLICT',
            'RATE_LIMITED',
            'INTERNAL_ERROR',
            'ACCOUNT_SUSPENDED',
            'ORGANIZATION_INACTIVE',
            'TOKEN_EXPIRED',
            'INVALID_TOKEN',
            'LAST_ADMIN',
            'STALE_VERSION',
            'NOT_READY',
          ],
        },
        message: { type: 'string' },
        details: {
          type: 'array',
          nullable: true,
          items: {
            type: 'object',
            properties: { field: { type: 'string' }, message: { type: 'string' } },
          },
        },
      },
    },
  },
};

const paginationMetaSchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', example: 1 },
    limit: { type: 'integer', example: 20 },
    total: { type: 'integer', example: 42 },
    totalPages: { type: 'integer', example: 3 },
  },
};

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Document Generation Platform API',
      version: '0.1.0',
      description: 'See docs/PRD/05-api-design.md for the full endpoint catalog.',
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: errorSchema,
        PaginationMeta: paginationMetaSchema,
      },
      responses: {
        Unauthorized: {
          description: 'Missing, expired, or invalid access token',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Forbidden: {
          description: "Authenticated, but the actor's role lacks the required permission",
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        NotFound: {
          description: 'No matching resource in the caller’s organization',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        ValidationError: {
          description: 'Request body failed schema validation',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Conflict: {
          description: 'The request conflicts with the resource’s current state',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Registration, session, and password-reset endpoints' },
      { name: 'Organizations', description: 'The caller’s own organization profile' },
      { name: 'Users', description: 'Organization member management (invite, role, status)' },
      {
        name: 'Settings',
        description: 'Per-organization preferences (theme, currency, paper size, ...)',
      },
      { name: 'Customers', description: 'The people/accounts documents are generated for' },
      { name: 'Assets', description: 'Logos, signatures, and fonts used by templates' },
      { name: 'Search', description: 'Cross-entity global search' },
      { name: 'Audit Logs', description: 'Read-only trail of every state-changing action' },
      {
        name: 'Templates',
        description: 'Template CRUD, versioning, publish/restore, preview, export/import',
      },
      {
        name: 'Field Definitions',
        description: 'System + custom data fields available to templates',
      },
      {
        name: 'Documents',
        description: 'Single and bulk document generation, retrieval, and PDFs',
      },
      { name: 'Dashboard', description: 'Aggregate KPI/activity summary' },
      { name: 'Notifications', description: 'The caller’s own in-app notifications' },
      { name: 'Health', description: 'Liveness/readiness checks (unauthenticated)' },
    ],
  },
  apis: ['./src/modules/**/*.routes.ts'],
});
