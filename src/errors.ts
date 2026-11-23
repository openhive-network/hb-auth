// That file contains generic error constructor and common errors
export class GenericError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GenericError";
  }
}

export class AuthorizationError extends Error {
  constructor(message: unknown, options?: ErrorOptions) {
    super(message instanceof Error ? message.message : String(message), options);
    this.name = "AuthorizationError";
  }
}

export class InternalError extends Error {
  constructor(message: unknown, options?: ErrorOptions) {
    super(message instanceof Error ? message.message : String(message), options);
    this.name = "InternalError";
  }
}

// Thrown by `sign` for an active or owner key while the user's wallet requires a
// check before active-key operations; the signature needs `signWithCheck`.
export class CheckRequiredError extends Error {
  constructor(message: unknown, options?: ErrorOptions) {
    super(message instanceof Error ? message.message : String(message), options);
    this.name = "CheckRequiredError";
  }
}

export class PasskeyError extends Error {
  readonly code: string;
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PasskeyError";
    this.code = code;
  }
}
