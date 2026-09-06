import { SITE_NAME, absolute } from "@/lib/site";

/* What a crawler is told about a page, beside what it can read. Two shapes
   and no more: the hub is a collection of the ten genre pages, and a
   genre page is a list of its topics with no URL per item, because a
   topic has no page of its own. */

export function collectionPage(name: string, description: string, path: string, itemPaths: string[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: absolute(path),
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absolute("/") },
    hasPart: itemPaths.map((item) => ({ "@type": "WebPage", url: absolute(item) })),
  };
}

export function itemList(name: string, description: string, path: string, items: string[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    description,
    url: absolute(path),
    numberOfItems: items.length,
    itemListElement: items.map((text, index) => ({ "@type": "ListItem", position: index + 1, name: text })),
  };
}

/** Serialised for a script tag. `<` is escaped so a topic can never close
    the tag it sits in. */
export function jsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
