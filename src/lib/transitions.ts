/**
 * Names shared by elements that are "the same thing" on two pages, so a
 * navigation morphs one into the other (React `<ViewTransition name>`).
 * Slugs are lowercase letters, digits and hyphens - already valid CSS idents.
 */
export function salonCoverTransition(slug: string) {
  return `salon-cover-${slug}`;
}
