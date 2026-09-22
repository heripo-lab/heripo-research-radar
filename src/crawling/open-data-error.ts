/**
 * Reads what data.go.kr said when it refused a request.
 *
 * Its gateway answers a refusal with HTTP 400 and an XML envelope, whatever
 * format the service itself speaks. The envelope names the cause — a spent
 * daily quota, an unregistered key, a withdrawn service and a denied caller
 * are all different `returnReasonCode`s — but an adapter that reports only the
 * status throws that away.
 *
 * It cost a week to learn that. A nightly run failed at the same minute for
 * days with nothing in the log but `Request failed (status=502)`, and the
 * reason the gateway had supplied each time was discarded before anyone could
 * read it.
 */
export function describeOpenDataError(body: string): string | null {
  const read = (tag: string): string | undefined =>
    new RegExp(`<${tag}>\\s*([^<]*)</${tag}>`).exec(body)?.[1]?.trim();

  const parts = [
    read('errMsg'),
    read('returnReasonCode') && `code ${read('returnReasonCode')}`,
    read('returnAuthMsg'),
  ].filter((part): part is string => Boolean(part));

  if (parts.length > 0) {
    return parts.join(' / ');
  }

  // Not the documented envelope. A short body is still worth quoting; a long
  // one is a page rather than an error and only adds noise to the log.
  const trimmed = body.trim().replace(/\s+/g, ' ');

  return trimmed.length > 0 && trimmed.length <= 200 ? trimmed : null;
}
