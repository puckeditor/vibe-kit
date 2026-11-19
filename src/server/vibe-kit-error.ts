/**
 * An error to show the app's user, thrown from a read or write handler.
 *
 * Use it for rules your APIs enforce, such as "Refunds over $500 need finance
 * approval". Other errors reach the user as a generic failure.
 */
export class VibeKitError extends Error {
  /** The HTTP status to answer with. */
  readonly status: number;

  /**
   * Make the error.
   *
   * @param message The message to show the user.
   * @param status The HTTP status to answer with. Defaults to 400.
   */
  constructor(message: string, status = 400) {
    super(message);
    this.name = "VibeKitError";
    this.status = status;
  }
}
