/**
 * Error sanitization for secure logging
 * Prevents sensitive information (stack traces, internal paths, etc.)
 * from being persisted to logs or databases.
 */

/**
 * Sanitizes an error for safe logging — returns only the message and name,
 * never the stack trace or internal properties.
 */
export function sanitizeErrorForLogging(error: unknown): {
  message: string;
  name: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      // Ne JAMAIS inclure stack, cause, ou propriétés internes
    };
  }
  return { message: String(error), name: "UnknownError" };
}
