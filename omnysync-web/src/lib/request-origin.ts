/**
 * Resolution de l'origine d'une requete pour la protection CSRF.
 *
 * `request.nextUrl.origin` est derive du hostname interne du serveur
 * (generalement "localhost"), pas de l'hote reellement utilise par le
 * navigateur. Comparer l'en-tete `Origin` a cette valeur rejette donc toute
 * requete state-changing same-origin des que l'application est joignable via
 * un autre hostname ou un reverse proxy (127.0.0.1, IP LAN, hostname de
 * conteneur, domaine public).
 *
 * Les en-tetes `Host` / `X-Forwarded-*` decrivent l'origine utilisee par le
 * navigateur : c'est la reference correcte pour une verification d'origine.
 */

export interface RequestOriginSource {
  headers: { get(name: string): string | null }
  nextUrl: { origin: string; protocol: string }
}

export function toOrigin(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function resolveRequestOrigin(request: RequestOriginSource): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost || request.headers.get('host')?.trim()
  if (!host) return request.nextUrl.origin

  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const proto = forwardedProto || request.nextUrl.protocol.replace(':', '')

  return toOrigin(`${proto}://${host}`) ?? request.nextUrl.origin
}
