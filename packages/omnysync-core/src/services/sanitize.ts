/**
 * Nettoie les messages d'erreur pour éviter les fuites d'information
 * Supprime les tokens, clés API, chemins de fichiers, etc.
 */
export function sanitizeErrorMessage(error: unknown): string {
  const message =
    (error instanceof Error ? error.message : String(error)) || "Unknown error";

  return (
    message
      // Token patterns
      .replace(
        /(api[_-]?key|access[_-]?token|secret|password|credential)[=:]\s*\S+/gi,
        "$1=[REDACTED]",
      )
      .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
      // URL query params with secrets
      .replace(/(\?|&)(token|key|secret|password)=[^&\s]+/gi, "$1$2=[REDACTED]")
      // File paths
      .replace(
        /(\/[a-zA-Z0-9_\-./]+\/[a-zA-Z0-9_\-]+\.(ts|js|tsx|jsx|json))\b/gi,
        "[PATH_REDACTED]",
      )
      // Stack traces
      .replace(/\s+at\s+.+/g, "")
      // Truncate
      .substring(0, 500)
  );
}
