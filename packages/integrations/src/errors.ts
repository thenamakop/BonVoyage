export class IntegrationError extends Error {
  readonly provider: string;
  readonly retryable: boolean;

  constructor(provider: string, message: string, retryable: boolean) {
    super(message);
    this.name = 'IntegrationError';
    this.provider = provider;
    this.retryable = retryable;
  }
}
