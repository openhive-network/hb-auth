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
