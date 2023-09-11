// That file contains generic error constructor and common errors
export class GenericError extends Error {
  constructor(
    public description: string,
  ) {
    super(description);
    Object.setPrototypeOf(this, GenericError.prototype);
  }
}

export class EscapedError extends GenericError {
  // This is for dynamic errors where the message may be something from the user
  // It will work only in browser environment
  constructor(description: string) {
    super(htmlSafe(description));
  }
}

export function htmlSafe(str: string): string {
  return str
    ?.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
