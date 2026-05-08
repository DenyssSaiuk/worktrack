export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: unknown;

  constructor(args: { statusCode: number; code: string; message: string; details?: unknown }) {
    super(args.message);
    this.name = 'AppError';
    this.statusCode = args.statusCode;
    this.code = args.code;
    this.details = args.details;
  }
}

export const Errors = {
  badRequest: (message: string, details?: unknown): AppError =>
    new AppError({ statusCode: 400, code: 'BAD_REQUEST', message, details }),
  unauthorized: (message = 'Unauthorized'): AppError =>
    new AppError({ statusCode: 401, code: 'UNAUTHORIZED', message }),
  forbidden: (message = 'Forbidden'): AppError =>
    new AppError({ statusCode: 403, code: 'FORBIDDEN', message }),
  notFound: (message = 'Not found'): AppError =>
    new AppError({ statusCode: 404, code: 'NOT_FOUND', message }),
  conflict: (message: string): AppError =>
    new AppError({ statusCode: 409, code: 'CONFLICT', message }),
  unprocessable: (message: string, details?: unknown): AppError =>
    new AppError({ statusCode: 422, code: 'UNPROCESSABLE', message, details }),
  rateLimited: (message = 'Too many requests'): AppError =>
    new AppError({ statusCode: 429, code: 'RATE_LIMITED', message }),
  internal: (message = 'Internal error', details?: unknown): AppError =>
    new AppError({ statusCode: 500, code: 'INTERNAL', message, details }),
};
