/**
 * Editorial photography for the royal lab.
 *
 * Every panel uses the same photographs so the comparison is about the
 * design. Each id was checked to load before it was added here. `ratio` is
 * the crop requested from Unsplash for the slot the photo sits in, so a
 * portrait original arrives already cropped rather than as a 3000px download
 * that the browser then throws most of away.
 */

export interface RoyalPhoto {
  id: string;
  alt: string;
  /** Width / height of the crop to request. */
  ratio: number;
}

export const ROYAL_PHOTOS = {
  villa: {
    id: "photo-1582610116397-edb318620f90",
    alt: "A white modern villa with timber detailing beside a swimming pool",
    ratio: 16 / 9,
  },
  bungalow: {
    id: "photo-1613977257365-aaae5a9817ff",
    alt: "A white contemporary bungalow with a long swimming pool at dusk",
    ratio: 4 / 3,
  },
  penthouse: {
    id: "photo-1568115286680-d203e08a8be6",
    alt: "A penthouse living room with full-height glass windows over the city",
    ratio: 4 / 3,
  },
  living: {
    id: "photo-1598928506311-c55ded91a20c",
    alt: "A drawing room with a marble fireplace, white sofas and dark wood shelving",
    ratio: 4 / 3,
  },
  bedroom: {
    id: "photo-1616594039964-ae9021a400a0",
    alt: "A principal bedroom with an upholstered bed, gold chandelier and city view",
    ratio: 3 / 2,
  },
  bathroom: {
    id: "photo-1744025098626-66c0b9cb1ba8",
    alt: "A bathroom with marble walls and brass fixtures",
    ratio: 3 / 2,
  },
  dining: {
    id: "photo-1771218829838-f30edb7e0263",
    alt: "A formal dining room with a chandelier and patterned upholstered chairs",
    ratio: 2 / 1,
  },
  kitchen: {
    id: "photo-1683629357963-adf2b1fa9ad9",
    alt: "A kitchen with marble worktops and white cabinetry",
    ratio: 2 / 1,
  },
  sofa: {
    id: "photo-1555041469-a586c61ea9bc",
    alt: "A deep green upholstered sofa against a pale wall",
    ratio: 4 / 3,
  },
} satisfies Record<string, RoyalPhoto>;

/** A cropped, format-negotiated Unsplash URL at the given display width. */
export function photoUrl(photo: RoyalPhoto, width: number): string {
  const height = Math.round(width / photo.ratio);
  return `https://images.unsplash.com/${photo.id}?auto=format&fit=crop&w=${width}&h=${height}&q=80`;
}
