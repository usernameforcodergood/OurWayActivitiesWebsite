import type { Locale } from "@/i18n/config";

/**
 * Central image registry.
 *
 * All photography is referenced by a semantic key, so replacing an image never
 * requires touching component code. To use OurWay's own photo:
 *   1. put the file in /public/images (e.g. /public/images/hero.jpg)
 *   2. change `src` below to "/images/hero.jpg" and update width/height/alt
 *
 * Current images are PLACEHOLDERS from Unsplash (https://unsplash.com/license).
 * They illustrate the mood only — they do not depict confirmed OurWay
 * destinations or activities.
 */
export type MediaItem = {
  src: string;
  width: number;
  height: number;
  alt: Record<Locale, string>;
  /** Where the placeholder came from — remove when replaced. */
  source?: string;
};

// Fetch a 2400px master from Unsplash's CDN; next/image then serves resized AVIF/WebP.
const u = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=max&w=2400&q=80`;

export const media = {
  heroWalker: {
    src: u("1501425359013-96058e410cfc"),
    width: 2400,
    height: 1587,
    alt: {
      el: "Ένας άνθρωπος με σακίδιο στέκεται σε πλαγιά και κοιτάζει τις οροσειρές στον ορίζοντα",
      en: "A person with a backpack stands on a slope looking out over layered mountain ranges",
    },
    source: "Unsplash",
  },
  ridgeAutumn: {
    src: u("1635881648052-aa484c689909"),
    width: 2400,
    height: 1800,
    alt: {
      el: "Φθινοπωρινό δάσος μπροστά από βραχώδη κορυφή",
      en: "Autumn forest in front of a rocky mountain peak",
    },
    source: "Unsplash",
  },
  valleyVillage: {
    src: u("1793609967728-a3db262a9a01"),
    width: 2400,
    height: 1350,
    alt: {
      el: "Μικρό χωριό σε βαθιά κοιλάδα, περιτριγυρισμένο από πευκοδάσος και βουνά",
      en: "A small village in a deep valley surrounded by pine forest and mountains",
    },
    source: "Unsplash",
  },
  stoneBridge: {
    src: u("1653493170925-5a7086516ffa"),
    width: 2400,
    height: 1600,
    alt: {
      el: "Πέτρινο τοξωτό γεφύρι πάνω από ξερό ρέμα, με βουνά στο βάθος",
      en: "An arched stone bridge over a dry stream bed with mountains behind",
    },
    source: "Unsplash",
  },
  bridgeVillage: {
    src: u("1769813560947-31a5e9f25ef0"),
    width: 2400,
    height: 1800,
    alt: {
      el: "Παλιό πέτρινο γεφύρι που οδηγεί σε χωριό χτισμένο στην πλαγιά",
      en: "An old stone bridge leading to a village built on the hillside",
    },
    source: "Unsplash",
  },
  monasteryRock: {
    src: u("1552482496-3c03befc5c25"),
    width: 2400,
    height: 1600,
    alt: {
      el: "Μοναστήρι χτισμένο στην κορυφή απόκρημνου βράχου",
      en: "A monastery built on top of a sheer rock pillar",
    },
    source: "Unsplash",
  },
  cliffMonastery: {
    src: u("1761496832981-d1f61f3c9b27"),
    width: 2400,
    height: 1600,
    alt: {
      el: "Μοναστήρι σκαρφαλωμένο σε βραχώδη απότομη πλαγιά",
      en: "A monastery perched on a steep rock face",
    },
    source: "Unsplash",
  },
  gorgeRiver: {
    src: u("1578311638077-307d8a5ef6c4"),
    width: 2400,
    height: 3000,
    alt: {
      el: "Ποτάμι που κυλά ανάμεσα σε απότομες βουνοπλαγιές",
      en: "A river running between steep mountainsides",
    },
    source: "Unsplash",
  },
  gorgeAutumn: {
    src: u("1635881634792-08610a9b1688"),
    width: 2400,
    height: 1800,
    alt: {
      el: "Κοιλάδα με ποτάμι και φθινοπωρινά δέντρα",
      en: "A valley with a river and autumn-coloured trees",
    },
    source: "Unsplash",
  },
  sittingGorge: {
    src: u("1578311638217-e8ba151eaab2"),
    width: 2400,
    height: 1920,
    alt: {
      el: "Γυναίκα κάθεται στην άκρη πλαγιάς και κοιτάζει ένα βαθύ φαράγγι",
      en: "A woman sits at the edge of a slope looking into a deep gorge",
    },
    source: "Unsplash",
  },
  folkDanceCircle: {
    src: u("1757386491857-15ab7c25c4b3"),
    width: 2400,
    height: 1601,
    alt: {
      el: "Άνθρωποι με παραδοσιακές φορεσιές χορεύουν σε κύκλο",
      en: "People in traditional costume dancing in a circle",
    },
    source: "Unsplash",
  },
  folkDanceMen: {
    src: u("1757387010425-55ab09f73428"),
    width: 2400,
    height: 1600,
    alt: {
      el: "Χορευτές με παραδοσιακές ελληνικές φορεσιές σε λαϊκό χορό",
      en: "Dancers in traditional Greek costume performing a folk dance",
    },
    source: "Unsplash",
  },
  folkDanceWomen: {
    src: u("1757386502149-fac9f3896a96"),
    width: 2400,
    height: 1601,
    alt: {
      el: "Γυναίκες με παραδοσιακές φορεσιές χορεύουν",
      en: "Women in traditional costume dancing",
    },
    source: "Unsplash",
  },
  shepherd: {
    src: u("1762863733472-90ace473005f"),
    width: 2400,
    height: 1600,
    alt: {
      el: "Βοσκός οδηγεί κοπάδι προβάτων σε ανοιχτό λιβάδι",
      en: "A shepherd guiding a flock of sheep across an open field",
    },
    source: "Unsplash",
  },
  goatsCoast: {
    src: u("1781442511986-918df413bfe9"),
    width: 2400,
    height: 1600,
    alt: {
      el: "Άνθρωπος φροντίζει κατσίκια σε βραχώδες παραθαλάσσιο τοπίο",
      en: "A person tending goats on a rocky coastal landscape",
    },
    source: "Unsplash",
  },
  stoneHouse: {
    src: u("1648218299697-89d44412992d"),
    width: 2400,
    height: 1605,
    alt: {
      el: "Πέτρινο σπίτι με μπλε παραθυρόφυλλα και κεραμοσκεπή",
      en: "A stone house with blue shutters and a tiled roof",
    },
    source: "Unsplash",
  },
  villageSteps: {
    src: u("1602591546738-ceab3d349681"),
    width: 2400,
    height: 2830,
    alt: {
      el: "Πλακόστρωτο σοκάκι με ξύλινα τραπέζια κάτω από δέντρα",
      en: "A paved village lane with wooden tables beneath the trees",
    },
    source: "Unsplash",
  },
  riverForest: {
    src: u("1559336123-0f5e6b109cdd"),
    width: 2400,
    height: 1350,
    alt: {
      el: "Καταπράσινο ποτάμι που κυλά μέσα σε πυκνό δάσος",
      en: "A clear green river flowing through dense forest",
    },
    source: "Unsplash",
  },
  streamRocks: {
    src: u("1754810075322-4cc911cfdfdb"),
    width: 2400,
    height: 1600,
    alt: {
      el: "Ρηχό ρέμα που κυλά πάνω από πέτρες μέσα στο δάσος",
      en: "A shallow stream flowing over stones in a forest",
    },
    source: "Unsplash",
  },
  coastCliff: {
    src: u("1508240782898-53ee4351d612"),
    width: 2400,
    height: 1600,
    alt: {
      el: "Λευκοί βράχοι που πέφτουν απότομα σε γαλάζια θάλασσα",
      en: "White cliffs dropping sharply into deep blue sea",
    },
    source: "Unsplash",
  },
  mesaPlain: {
    src: u("1697949778234-2c3e6f537896"),
    width: 2400,
    height: 1600,
    alt: {
      el: "Ομίχλη πάνω από κάμπο, με επιβλητικό επίπεδο βουνό στο βάθος",
      en: "Mist over a plain with a broad flat-topped mountain beyond",
    },
    source: "Unsplash",
  },
  sheepMountain: {
    src: u("1716125954865-70ea1f15508c"),
    width: 2400,
    height: 3607,
    alt: {
      el: "Ένα πρόβατο σε χωράφι με βουνό στο βάθος",
      en: "A sheep in a field with a mountain in the background",
    },
    source: "Unsplash",
  },
  hillChapel: {
    src: u("1638536432720-58290d0ad42e"),
    width: 2400,
    height: 1347,
    alt: {
      el: "Λευκό ξωκλήσι σε λόφο με πέτρινο μονοπάτι που οδηγεί σε αυτό",
      en: "A white chapel on a hill with a stone path leading to it",
    },
    source: "Unsplash",
  },
  roadPause: {
    src: u("1616170356968-0ffa557a7c86"),
    width: 2400,
    height: 4267,
    alt: {
      el: "Δύο άνθρωποι κάθονται στην άκρη ενός ορεινού δρόμου",
      en: "Two people sitting at the side of a mountain road",
    },
    source: "Unsplash",
  },
  canyonAutumn: {
    src: u("1635881635387-563ec97a7cf8"),
    width: 2400,
    height: 1800,
    alt: {
      el: "Θέα σε κοιλάδα με φθινοπωρινά δέντρα και βουνά",
      en: "A view over a valley with autumn trees and mountains",
    },
    source: "Unsplash",
  },
  oliveTrail: {
    src: u("1716125954897-a22bdb7dc1b7"),
    width: 2400,
    height: 3607,
    alt: {
      el: "Παγκάκι κάτω από δέντρο δίπλα σε χωμάτινο μονοπάτι",
      en: "A bench beneath a tree beside a dirt path",
    },
    source: "Unsplash",
  },

  // ── OurWay's own photography (public/images/ourway) ─────────────────────
  owEverest: {
    src: "/images/ourway/everest-base-camp.jpg",
    width: 1080,
    height: 1351,
    alt: {
      el: "Τρεις ταξιδιώτισσες στο Everest Base Camp κρατούν τη σημαία της OurWay, με σημαιάκια προσευχής και χιονισμένες κορυφές πίσω τους",
      en: "Three travellers at Everest Base Camp holding the OurWay flag, with prayer flags and snowy peaks behind them",
    },
  },
  owCoastTrail: {
    src: "/images/ourway/coast-trail.jpg",
    width: 863,
    height: 1078,
    alt: {
      el: "Πεζοπόρος κατεβαίνει πράσινο μονοπάτι προς τη θάλασσα, με νησί στον ορίζοντα",
      en: "A hiker walks down a green trail towards the sea, with an island on the horizon",
    },
  },
  owWaterfall: {
    src: "/images/ourway/waterfall-cliff.jpg",
    width: 1440,
    height: 1800,
    alt: {
      el: "Ψηλός καταρράκτης κυλά πάνω σε στρωματωμένο βράχο, με πεζοπόρο να ξεκουράζεται στη βάση του",
      en: "A tall waterfall runs down layered rock, with a hiker resting at its foot",
    },
  },
  owWorkshopPress: {
    src: "/images/ourway/workshop-press.jpg",
    width: 1200,
    height: 1600,
    alt: {
      el: "Συμμετέχων σε εργαστήρι βιβλιοδεσίας δουλεύει σε παλιά ξύλινη πρέσα",
      en: "A participant in a bookbinding workshop working at an old wooden press",
    },
  },
  owWorkshopTable: {
    src: "/images/ourway/workshop-table.jpg",
    width: 1200,
    height: 1600,
    alt: {
      el: "Παρέα γύρω από το τραπέζι ενός εργαστηρίου βιβλιοδεσίας, μαθαίνοντας την τέχνη",
      en: "A group around the table of a bookbinding workshop, learning the craft",
    },
  },
  owStoneLane: {
    src: "/images/ourway/stone-lane.jpg",
    width: 1138,
    height: 1138,
    alt: {
      el: "Πέτρινο σπίτι με γαλάζια παράθυρα και λουλούδια σε πλακόστρωτο σοκάκι ορεινού χωριού",
      en: "A stone house with blue windows and flowers on a cobbled lane in a mountain village",
    },
  },
  owCaveChapel: {
    src: "/images/ourway/cave-chapel.jpg",
    width: 1728,
    height: 1296,
    alt: {
      el: "Ασβεστωμένο ξωκλήσι χτισμένο μέσα σε σπηλιά, κάτω από βράχο",
      en: "A whitewashed chapel built inside a cave, beneath an overhanging rock",
    },
  },
  owLocalProducts: {
    src: "/images/ourway/local-products.jpg",
    width: 1728,
    height: 1152,
    alt: {
      el: "Μπουκάλια με τοπικό προϊόν και ετικέτα OurWay σε ξύλινο τελάρο, κάτω από δέντρα",
      en: "Bottles of a local product with OurWay labels in a wooden crate, beneath the trees",
    },
  },
  owAutumnPath: {
    src: "/images/ourway/autumn-path.jpg",
    width: 1536,
    height: 1536,
    alt: {
      el: "Χωμάτινος δρόμος σκεπασμένος με φθινοπωρινά φύλλα μέσα σε ορεινό δάσος",
      en: "A dirt road covered in autumn leaves running through a mountain forest",
    },
  },
  owFogForest: {
    src: "/images/ourway/fog-forest.jpg",
    width: 1200,
    height: 1500,
    alt: {
      el: "Πεζοπόρος σταματά και κοιτάζει ψηλά τα δέντρα ενός ομιχλιασμένου δάσους",
      en: "A hiker stops to look up at the trees of a misty forest",
    },
  },
  owSummitMarker: {
    src: "/images/ourway/summit-marker.jpg",
    width: 1253,
    height: 1875,
    alt: {
      el: "Δύο πεζοπόροι στέκονται στο τριγωνομετρικό της κορυφής, με οροσειρές και ουρανό γύρω τους",
      en: "Two hikers stand on the summit marker, surrounded by mountain ranges and sky",
    },
  },
  owMeadowGroup: {
    src: "/images/ourway/meadow-group.jpg",
    width: 1253,
    height: 1875,
    alt: {
      el: "Ομάδα πεζοπόρων σε ορεινό λιβάδι πάνω από τη θάλασσα, κάποιοι κάνουν χαρούμενα ασκήσεις ισορροπίας",
      en: "A group of hikers on a mountain meadow above the sea, some striking playful balance poses",
    },
  },
  owSummitFlag: {
    src: "/images/ourway/summit-flag.jpg",
    width: 1200,
    height: 900,
    alt: {
      el: "Η παρέα της OurWay στην κορυφή με τη σημαία της, πάνω από θάλασσα από σύννεφα και χιονισμένα βουνά",
      en: "The OurWay group on the summit with its flag, above a sea of clouds and snowy mountains",
    },
  },
  owRidgeCrest: {
    src: "/images/ourway/ridge-crest.jpg",
    width: 2000,
    height: 1336,
    alt: {
      el: "Πεζοπόροι σε σειρά στην κόψη ενός χορταριασμένου βουνού, κάτω από μεγάλα σύννεφα",
      en: "Hikers in a line along the crest of a grassy mountain beneath big clouds",
    },
  },
  owSlopeAscent: {
    src: "/images/ourway/slope-ascent.jpg",
    width: 2000,
    height: 1336,
    alt: {
      el: "Ομάδα πεζοπόρων ανεβαίνει μονοπάτι σε απότομη χορταριασμένη πλαγιά",
      en: "A group of hikers climbs a path across a steep grassy slope",
    },
  },
  owCyclists: {
    src: "/images/ourway/cyclists.jpg",
    width: 1728,
    height: 1152,
    alt: {
      el: "Παρέα ποδηλατών με κράνη και ανακλαστικά γιλέκα σε χωματόδρομο ανάμεσα σε πράσινους λόφους",
      en: "A group of cyclists in helmets and high-visibility vests on a dirt road among green hills",
    },
  },
  owCairnClouds: {
    src: "/images/ourway/cairn-clouds.jpg",
    width: 865,
    height: 1080,
    alt: {
      el: "Πέτρινο ανθρωπάκι πάνω από θάλασσα από σύννεφα, με χιονισμένη οροσειρά στο βάθος",
      en: "A stone cairn above a sea of clouds, with a snow-capped range in the distance",
    },
  },
  owTrailClimb: {
    src: "/images/ourway/trail-climb.jpg",
    width: 1875,
    height: 1253,
    alt: {
      el: "Πεζοπόροι με σακίδια ανεβαίνουν βραχώδες μονοπάτι σε ορεινό λιβάδι",
      en: "Hikers with backpacks climb a rocky path across a mountain meadow",
    },
  },
  owRefugeCircle: {
    src: "/images/ourway/refuge-circle.jpg",
    width: 1875,
    height: 1253,
    alt: {
      el: "Η ομάδα σε κύκλο έξω από ορεινό καταφύγιο, πριν ξεκινήσει η πεζοπορία",
      en: "The group gathered in a circle outside a mountain refuge before the hike",
    },
  },
  owRefugeEvening: {
    src: "/images/ourway/refuge-evening.jpg",
    width: 1875,
    height: 785,
    alt: {
      el: "Μεγάλη παρέα φωτογραφίζεται μπροστά στο τζάκι ενός καταφυγίου το βράδυ",
      en: "A large group poses in front of the fireplace of a refuge in the evening",
    },
  },
  owForestBridge: {
    src: "/images/ourway/forest-bridge.jpg",
    width: 1728,
    height: 1296,
    alt: {
      el: "Παρέα πεζοπόρων χαμογελά πάνω σε ξύλινο γεφυράκι μέσα στο δάσος",
      en: "A group of hikers smiles on a small wooden bridge in the forest",
    },
  },
} satisfies Record<string, MediaItem>;

export type MediaKey = keyof typeof media;

/** Ordered list used by the gallery page. Add, remove or reorder keys freely. */
export const galleryKeys: MediaKey[] = [
  "owCairnClouds",
  "owTrailClimb",
  "owWaterfall",
  "owStoneLane",
  "owRefugeCircle",
  "owAutumnPath",
  "owCyclists",
  "owCaveChapel",
  "owRidgeCrest",
  "owFogForest",
  "owForestBridge",
  "owEverest",
  "owRefugeEvening",
  "owLocalProducts",
  "owCoastTrail",
  "owMeadowGroup",
  "owWorkshopTable",
  "owSummitMarker",
  "owSummitFlag",
  "owSlopeAscent",
  "owWorkshopPress",
];
