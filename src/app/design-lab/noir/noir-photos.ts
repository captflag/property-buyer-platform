/**
 * Photography for Noir Editorial.
 *
 * Every image is graded to black and white by the stylesheet, so they are
 * chosen for form and light -- strong architecture, hard shadow, clear
 * silhouettes -- rather than for colour. Each id was checked to load before
 * it was added.
 */

export interface NoirPhoto {
  id: string;
  alt: string;
  /** Width / height of the crop to request for this photo's slot. */
  ratio: number;
}

export const NOIR = {
  hero: {
    id: "photo-1613977257365-aaae5a9817ff",
    alt: "A white contemporary villa with a long swimming pool",
    ratio: 4 / 3,
  },
  residence: {
    id: "photo-1631739645757-b4208e024dad",
    alt: "A modern house with every window lit after dark",
    ratio: 4 / 3,
  },
  programme: {
    id: "photo-1673542004108-7ed4128d4b66",
    alt: "A house in darkness with only its roofline lit",
    ratio: 3 / 4,
  },
  living: {
    id: "photo-1598928506311-c55ded91a20c",
    alt: "A drawing room with a marble fireplace, pale sofas and dark shelving",
    ratio: 4 / 3,
  },
  kitchen: {
    id: "photo-1695542958346-d51b0c2f1917",
    alt: "A black kitchen with marble worktops and black cabinetry",
    ratio: 4 / 5,
  },
  bedroom: {
    id: "photo-1693907587800-702409d6c8fd",
    alt: "A bed in a dark room, photographed in black and white",
    ratio: 4 / 5,
  },
  stair: {
    id: "photo-1691325483800-3b86f809399c",
    alt: "The shadow of a staircase falling across a wall",
    ratio: 3 / 4,
  },
  marble: {
    id: "photo-1550053808-52a75a05955d",
    alt: "Close-up of black marble",
    ratio: 64 / 44,
  },
  concrete: {
    id: "photo-1575722290270-626b0208df99",
    alt: "A grey concrete floor",
    ratio: 64 / 44,
  },
} satisfies Record<string, NoirPhoto>;

/** A cropped, format-negotiated Unsplash URL at the given display width. */
export function noirUrl(photo: NoirPhoto, width: number, ratio = photo.ratio): string {
  const height = Math.round(width / ratio);
  return `https://images.unsplash.com/${photo.id}?auto=format&fit=crop&w=${width}&h=${height}&q=80`;
}
