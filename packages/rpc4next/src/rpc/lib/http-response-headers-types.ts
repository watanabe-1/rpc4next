import type { ContentType } from "./content-type-types";

/**
 * Represents HTTP response headers with optional fields, parameterized by the content type.
 * This type includes common headers used for caching, content description, CORS, authentication, security, cookies, redirects, connection, and server information.
 *
 * @template TContentType - The specific content type for the `Content-Type` header.
 */
export type HttpResponseHeaders<TContentType extends ContentType> = Partial<{
  // Cache control
  "Cache-Control": string;
  Expires: string;
  ETag: string;
  "Last-Modified": string;
  Age: string;

  // Content information
  "Content-Type": TContentType;
  "Content-Length": string;
  "Content-Encoding": string;
  "Content-Language": string;
  "Content-Location": string;
  "Content-Disposition": string;
  "Content-Range": string;
  "Content-Digest": string;
  "Content-Security-Policy": string;
  "Content-Security-Policy-Report-Only": string;

  // CORS-related
  "Access-Control-Allow-Origin": string;
  "Access-Control-Allow-Credentials": string;
  "Access-Control-Allow-Headers": string;
  "Access-Control-Allow-Methods": string;
  "Access-Control-Expose-Headers": string;
  "Access-Control-Max-Age": string;

  // Authentication
  "WWW-Authenticate": string;
  "Proxy-Authenticate": string;

  // Security
  "Strict-Transport-Security": string;
  "X-Content-Type-Options": string;
  "X-Frame-Options": string;
  "Referrer-Policy": string;
  "Cross-Origin-Opener-Policy": string;
  "Cross-Origin-Embedder-Policy": string;
  "Cross-Origin-Resource-Policy": string;

  // Cookies
  "Set-Cookie": string;

  // Redirects
  Location: string;

  // Connection and communication
  Connection: string;
  "Keep-Alive": string;
  "Transfer-Encoding": string;
  Upgrade: string;
  Vary: string;
  Trailer: string;
  "Upgrade-Insecure-Requests": string;

  // Server information
  Date: string;
  Server: string;

  // Client hints
  "Accept-CH": string;
  "Accept-Patch": string;
  "Accept-Post": string;
  "Accept-Ranges": string;

  // Others
  Allow: string;
  "Alt-Svc": string;
  "Alt-Used": string;
  "Clear-Site-Data": string;
  Link: string;
  "Origin-Agent-Cluster": string;
  "Preference-Applied": string;
  Priority: string;
  "Reporting-Endpoints": string;
  "Retry-After": string;
  "Server-Timing": string;
  SourceMap: string;
  "Timing-Allow-Origin": string;
  "Want-Content-Digest": string;
  "Want-Repr-Digest": string;
}>;
