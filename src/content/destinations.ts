import { isVisible, type Destination } from "./types";

/**
 * Confirmed OurWay destinations go here. None are confirmed yet, so the
 * destinations page presents the kinds of landscape OurWay is drawn to
 * (from the message files) instead of specific places.
 *
 * Template entry (draft, hidden in production) shows the expected shape.
 */
export const destinations: Destination[] = [
  {
    slug: "example-destination",
    status: "draft",
    name: { el: "[Πρότυπο] Όνομα τόπου", en: "[Template] Place name" },
    region: { el: "[Περιοχή]", en: "[Region]" },
    summary: {
      el: "Λίγα λόγια για τον τόπο, τον χαρακτήρα και τους ανθρώπους του.",
      en: "A few words on the place, its character and its people.",
    },
    image: "valleyVillage",
  },
];

export function getDestinations(): Destination[] {
  return destinations.filter(isVisible);
}
