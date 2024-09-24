export class ApophisError extends Error {
  /** Whether the error can be displayed to the user. */
  canDisplay = false;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
