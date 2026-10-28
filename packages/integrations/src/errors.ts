export class IntegrationError extends Error {
  readonly provider: string;
  readonly retryable: boolean;
  /** Raw model output for spike debugging; never logged above debug. */
  readonly rawText?: string;

  constructor(provider: string, message: string, retryable: boolean, rawText?: string) {
    super(message);
    this.name = 'IntegrationError';
    this.provider = provider;
    this.retryable = retryable;
    this.rawText = rawText;
  }
}

/** #121: the model answered, but not usably (no text, not JSON, or outside the schema). */
export class ModelOutputError extends IntegrationError {
  constructor(provider: string, message: string, rawText?: string) {
    super(provider, message, false, rawText);
    this.name = 'ModelOutputError';
  }
}
