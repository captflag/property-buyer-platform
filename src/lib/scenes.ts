/**
 * Cinematic photography.
 *
 * Atmospheric scenes for the landing page and the page bands at the top of
 * the app: architecture at dusk, lit interiors, warm light. They set the mood
 * of a page; they are never presented as the buyer's own house, which is only
 * ever shown through its real site photographs.
 *
 * Every id was checked to load. Images come from Unsplash under the Unsplash
 * licence and are served by Unsplash's own image CDN, which resizes and picks
 * the format (AVIF/WebP) per request -- see `sceneSrcSet`. For a deployment
 * that must not depend on a third-party CDN, download the same files, place
 * them in /public and point `sceneSrc` there; nothing else changes.
 */

export interface Scene {
  id: string;
  alt: string;
  /** CSS object-position, when the subject is not centred. */
  focus?: string;
}

export const SCENES = {
  villaDusk: {
    id: "photo-1757356657991-c3fd6e2e812e",
    alt: "A modern luxury home with swimming pools, lit at dusk",
    focus: "50% 60%",
  },
  windowsDusk: {
    id: "photo-1757359056339-22968344cce6",
    alt: "A modern home with full-height windows glowing at dusk",
  },
  houseGlow: {
    id: "photo-1748063578185-3d68121b11ff",
    alt: "A modern house exterior glowing with warm light after sunset",
  },
  concreteNight: {
    id: "photo-1505843513577-22bb7d21e455",
    alt: "A white and black concrete house lit from within at night",
  },
  pathwayDusk: {
    id: "photo-1762811054947-605b20298615",
    alt: "A modern white house with an illuminated pathway at dusk",
  },
  villaPool: {
    id: "photo-1613977257365-aaae5a9817ff",
    alt: "A white contemporary villa with a long swimming pool",
    focus: "50% 70%",
  },
  penthouse: {
    id: "photo-1568115286680-d203e08a8be6",
    alt: "A penthouse living room with full-height glass walls over the city",
  },
  fireplace: {
    id: "photo-1598928506311-c55ded91a20c",
    alt: "A drawing room with a marble fireplace, pale sofas and dark shelving",
  },
  bedroom: {
    id: "photo-1616594039964-ae9021a400a0",
    alt: "A bedroom with an upholstered bed, a gold chandelier and a city view",
  },
  kitchen: {
    id: "photo-1683629357963-adf2b1fa9ad9",
    alt: "A kitchen with marble worktops and white cabinetry",
  },
  dining: {
    id: "photo-1771218829838-f30edb7e0263",
    alt: "A formal dining room with a chandelier and upholstered chairs",
  },
  bath: {
    id: "photo-1744025098626-66c0b9cb1ba8",
    alt: "A bathroom with marble walls and brass fixtures",
  },
} satisfies Record<string, Scene>;

export type SceneKey = keyof typeof SCENES;

const WIDTHS = [640, 1024, 1600, 2400] as const;

/** A single rendition at the given width. */
export function sceneSrc(key: SceneKey, width: number): string {
  return `https://images.unsplash.com/${SCENES[key].id}?auto=format&fit=crop&w=${width}&q=80`;
}

/**
 * The scene behind a page's glass. Matches the scene each page's header
 * uses, so the blurred backdrop and the photograph at the top agree.
 */
const PATH_SCENES: Array<[string, SceneKey]> = [
  ["/timeline", "windowsDusk"],
  ["/updates", "pathwayDusk"],
  ["/gallery", "houseGlow"],
  ["/selections", "kitchen"],
  ["/questions", "fireplace"],
  ["/visits", "villaPool"],
  ["/finance", "penthouse"],
  ["/quality", "bath"],
  ["/analytics", "concreteNight"],
  ["/move-in", "bedroom"],
  ["/documents", "dining"],
];

export function sceneForPath(pathname: string): SceneKey {
  return PATH_SCENES.find(([segment]) => pathname.includes(segment))?.[1] ?? "windowsDusk";
}

/** Responsive renditions for `srcSet`. */
export function sceneSrcSet(key: SceneKey): string {
  return WIDTHS.map((width) => `${sceneSrc(key, width)} ${width}w`).join(", ");
}
