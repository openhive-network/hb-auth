// That file contains human readable errors
export class EscapedError extends Error {
  // This is for dynamic errors where the message may be something from the user
  // It will work only in browser environment
  constructor(message: string) {
    super(htmlSafe(message));
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
