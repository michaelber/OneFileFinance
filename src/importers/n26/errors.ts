export class N26AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'N26AuthError';
  }
}

export class MFATimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MFATimeoutError';
  }
}

export class SessionExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class NoTransactionsFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoTransactionsFoundError';
  }
}

export class N26ImportError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'N26ImportError';
  }
}
