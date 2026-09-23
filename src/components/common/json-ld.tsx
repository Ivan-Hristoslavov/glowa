/**
 * Emits structured data.
 *
 * The payload is built on the server from database rows, never from user input
 * reaching this component directly, and `</` is escaped so a salon named with
 * a stray tag cannot break out of the script element.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
