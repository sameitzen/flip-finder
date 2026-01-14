// Custom error types for better handling
export type GeminiErrorCode =
  | 'API_KEY_MISSING'
  | 'RATE_LIMIT'
  | 'PARSE_ERROR'
  | 'UNIDENTIFIABLE'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly code: GeminiErrorCode,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}
