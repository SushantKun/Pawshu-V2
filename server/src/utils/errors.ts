export class NotFoundError extends Error {
  status: number;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

export class ValidationError extends Error {
  status: number;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

export class AuthorizationError extends Error {
  status: number;
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
    this.status = 403;
  }
} 