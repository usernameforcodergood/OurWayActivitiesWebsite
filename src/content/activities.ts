import { isVisible, type Activity } from "./types";

/**
 * OurWay experiences.
 *
 * The catalogue is not finalised, so no real experience is published yet.
 * The single entry below is a clearly-labelled DRAFT TEMPLATE that shows the
 * owner how a page will look. It is hidden in production (see isVisible).
 *
 * To publish a real experience: copy the template, give it a new slug, fill
 * in ONLY confirmed information, and set status: "published".
 */
export const activities: Activity[] = [
  {
    slug: "example-experience",
    status: "draft",
    title: {
      el: "[Πρότυπο] Τίτλος εμπειρίας",
      en: "[Template] Experience title",
    },
    summary: {
      el: "Σύντομη εισαγωγή δύο γραμμών που περιγράφει τι θα ζήσει κάποιος. Αντικαταστήστε το με πραγματικό κείμενο.",
      en: "A two-line introduction describing what someone will experience. Replace with real copy.",
    },
    image: "bridgeVillage",
    gallery: ["stoneHouse", "villageSteps", "gorgeRiver"],
    description: {
      el: [
        "Αυτή είναι μια σελίδα-πρότυπο. Εδώ θα μπει η πλήρης περιγραφή της εμπειρίας: τι περιλαμβάνει, πώς κυλά η μέρα, ποιους ανθρώπους θα συναντήσει κανείς και τι κάνει αυτόν τον τόπο ξεχωριστό.",
        "Κάθε πεδίο είναι προαιρετικό. Όσα δεν συμπληρωθούν απλώς δεν εμφανίζονται.",
      ],
      en: [
        "This is a template page. The full description of the experience goes here: what it involves, how the day unfolds, who you meet along the way and what makes the place distinctive.",
        "Every field is optional. Anything left empty is simply not shown.",
      ],
    },
    location: { el: "[Τοποθεσία]", en: "[Location]" },
    experienceType: { el: "[Τύπος εμπειρίας]", en: "[Experience type]" },
    duration: { el: "[Διάρκεια]", en: "[Duration]" },
    importantInfo: {
      el: ["[Σημαντική πληροφορία — π.χ. τι να φέρετε μαζί σας]"],
      en: ["[Important information — e.g. what to bring]"],
    },
    bookingEnabled: true,
  },
];

export function getActivities(): Activity[] {
  return activities.filter(isVisible);
}

export function getActivity(slug: string): Activity | undefined {
  const activity = activities.find((a) => a.slug === slug);
  return activity && isVisible(activity) ? activity : undefined;
}

/** All slugs (including drafts) so routes are statically known; drafts 404 in production. */
export function getAllActivitySlugs(): string[] {
  return activities.map((a) => a.slug);
}
