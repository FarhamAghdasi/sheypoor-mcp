export class SheypoorError extends Error {
  override readonly name: string = "SheypoorError";
}

export class SheypoorAuthError extends SheypoorError {
  override readonly name = "SheypoorAuthError";
}

export class SheypoorNotFound extends SheypoorError {
  override readonly name = "SheypoorNotFound";
}

export class SheypoorRateLimitError extends SheypoorError {
  override readonly name = "SheypoorRateLimitError";
  constructor(
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
