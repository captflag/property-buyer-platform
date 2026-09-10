/**
 * Demo data for the buyer-experience features: selections, questions, site
 * visits and the move-in plan.
 *
 * Kept apart from the main dataset because it is built *from* it -- selection
 * deadlines hang off real milestones, questions attach to real updates, visits
 * land on real bookable slots -- and because every value here is derived from
 * the reference date, so the story stays current however long after writing
 * this it runs.
 *
 * The narrative is deliberate. Of eleven decisions: two confirmed through an
 * approved change order, one chosen and awaiting confirmation, one overdue
 * (sockets, which must be settled before the walls are boarded), one urgent,
 * two due soon -- one of which has an option whose lead time can no longer be
 * met -- and the rest comfortably ahead. A demo where every decision is either
 * done or distant would hide exactly the states the interface exists for.
 */

import { availableSlots } from "@/lib/domain/visits";
import { addDays, toDateString } from "@/lib/format";
import type {
  Discussion,
  DiscussionMessage,
  Milestone,
  MoveTask,
  SelectionCategory,
  SelectionOption,
  SiteVisit,
  Update,
} from "@/types/database";

export interface BuyerData {
  selectionCategories: SelectionCategory[];
  selectionOptions: SelectionOption[];
  discussions: Discussion[];
  discussionMessages: DiscussionMessage[];
  siteVisits: SiteVisit[];
  moveTasks: MoveTask[];
  /** When the demo buyer last marked the project as caught up. */
  buyerLastSeenAt: string;
}

function stableId(kind: string, n: number): string {
  const hash = [...kind].reduce((h, c) => (h * 33 + c.charCodeAt(0)) % 0xffff, 11);
  const block = hash.toString(16).padStart(4, "0");
  const suffix = String(n).padStart(4, "0");
  return `${block}${suffix}-1111-4111-8111-${block}${suffix}1111`;
}

interface OptionSpec {
  name: string;
  description: string;
  supplier: string;
  finish: string;
  priceDelta: number;
  leadDays: number;
  standard?: boolean;
  swatch: string;
}

interface CategorySpec {
  name: string;
  room: string;
  milestone: string;
  description: string;
  /** Days from today; omit to derive from the programme. */
  explicitDeadline?: number;
  status: SelectionCategory["status"];
  /** Index into `options` of the chosen one, when status is not open. */
  chosen?: number;
  notes?: string;
  options: OptionSpec[];
}

const CATEGORIES: CategorySpec[] = [
  {
    name: "Extra sockets and data points",
    room: "Whole house",
    milestone: "Insulation & airtightness",
    description:
      "Additional double sockets and wired data points beyond the standard layout. These have to be settled before the walls are insulated and boarded — afterwards they mean chasing into finished plaster.",
    explicitDeadline: -3,
    status: "open",
    options: [
      {
        name: "Standard layout",
        description:
          "As drawn: two doubles per bedroom, four in the kitchen, one data point in the living room.",
        supplier: "Calder & Finch",
        finish: "White",
        priceDelta: 0,
        leadDays: 0,
        standard: true,
        swatch: "#F4F2EC",
      },
      {
        name: "Home-working pack",
        description:
          "Six extra double sockets and four wired data points, including the study and main bedroom.",
        supplier: "Calder & Finch",
        finish: "White",
        priceDelta: 1180,
        leadDays: 0,
        swatch: "#F4F2EC",
      },
      {
        name: "Home-working pack, brushed steel",
        description: "As above, with brushed-steel faceplates throughout.",
        supplier: "Calder & Finch",
        finish: "Brushed steel",
        priceDelta: 1640,
        leadDays: 7,
        swatch: "#A8ABAE",
      },
    ],
  },
  {
    name: "Staircase balustrade",
    room: "Stairs & landing",
    milestone: "Joinery & staircase",
    description: "The guarding on the open side of the stair and across the landing.",
    status: "open",
    options: [
      {
        name: "Painted timber spindles",
        description: "Square spindles and newels, painted to match the joinery.",
        supplier: "Kestrel Joinery",
        finish: "White satin",
        priceDelta: 0,
        leadDays: 21,
        standard: true,
        swatch: "#F1EFE8",
      },
      {
        name: "Oak and steel",
        description: "Oak handrail and newels with slim black steel balusters.",
        supplier: "Kestrel Joinery",
        finish: "Oak / black",
        priceDelta: 2600,
        leadDays: 42,
        swatch: "#B8895A",
      },
      {
        name: "Frameless glass",
        description: "Toughened glass panels in a floor channel, oak handrail.",
        supplier: "Clearline Glass",
        finish: "Clear",
        priceDelta: 3200,
        leadDays: 49,
        swatch: "#D7E6E9",
      },
    ],
  },
  {
    name: "Kitchen appliances",
    room: "Kitchen",
    milestone: "Kitchen & bathrooms",
    description:
      "Appliance choices set the cut-outs in the cabinetry, so the build team needs them earlier than the fitting date alone would suggest.",
    explicitDeadline: 9,
    status: "open",
    options: [
      {
        name: "Standard appliance pack",
        description:
          "Single oven, induction hob, extractor, integrated fridge-freezer and dishwasher.",
        supplier: "Bosch",
        finish: "Stainless",
        priceDelta: 0,
        leadDays: 14,
        standard: true,
        swatch: "#C9CBCC",
      },
      {
        name: "Integrated premium pack",
        description: "Double oven, venting hob, full-height fridge and freezer, quiet dishwasher.",
        supplier: "Neff",
        finish: "Stainless",
        priceDelta: 3750,
        leadDays: 49,
        swatch: "#B9BCBF",
      },
      {
        name: "Range cooker",
        description: "110cm dual-fuel range with matching hood. Built to order.",
        supplier: "Rangemaster",
        finish: "Cream",
        priceDelta: 2900,
        leadDays: 84,
        swatch: "#E9DFC6",
      },
    ],
  },
  {
    name: "Bathroom wall tiles",
    room: "Bathroom",
    milestone: "Kitchen & bathrooms",
    description: "Full-height tiling to the bath and shower walls, half-height elsewhere.",
    status: "open",
    options: [
      {
        name: "White gloss ceramic",
        description: "300×600 rectified ceramic, white grout.",
        supplier: "Tile Depot",
        finish: "Gloss white",
        priceDelta: 0,
        leadDays: 14,
        standard: true,
        swatch: "#F7F7F4",
      },
      {
        name: "Large-format stone porcelain",
        description: "600×1200 porcelain in a warm limestone finish.",
        supplier: "Tile Depot",
        finish: "Limestone matt",
        priceDelta: 1650,
        leadDays: 28,
        swatch: "#D9CCB4",
      },
      {
        name: "Handmade zellige",
        description: "Glazed handmade tiles with natural variation. Each batch differs slightly.",
        supplier: "Atelier Terre",
        finish: "Sage glaze",
        priceDelta: 2400,
        leadDays: 56,
        swatch: "#9FB29A",
      },
    ],
  },
  {
    name: "Internal doors and ironmongery",
    room: "Whole house",
    milestone: "Joinery & staircase",
    description: "Every internal door, with handles and hinges to match.",
    status: "open",
    options: [
      {
        name: "White primed flush",
        description: "Smooth flush doors, satin chrome lever handles.",
        supplier: "Kestrel Joinery",
        finish: "White",
        priceDelta: 0,
        leadDays: 14,
        standard: true,
        swatch: "#F2F0EA",
      },
      {
        name: "Painted shaker",
        description: "Four-panel shaker doors, painted on site, black handles.",
        supplier: "Kestrel Joinery",
        finish: "Painted",
        priceDelta: 1900,
        leadDays: 28,
        swatch: "#DADCD3",
      },
      {
        name: "Oak veneer four-panel",
        description: "Pre-finished oak veneer, brushed brass handles.",
        supplier: "Kestrel Joinery",
        finish: "Oak",
        priceDelta: 2850,
        leadDays: 35,
        swatch: "#C49A6C",
      },
    ],
  },
  {
    name: "Flooring — living areas",
    room: "Living room",
    milestone: "Flooring",
    description: "Hallway, living room, dining area and kitchen.",
    status: "open",
    options: [
      {
        name: "Engineered oak, natural",
        description: "14mm engineered oak, brushed and oiled, 190mm boards.",
        supplier: "Oakwood Floors",
        finish: "Natural oak",
        priceDelta: 0,
        leadDays: 21,
        standard: true,
        swatch: "#C8A273",
      },
      {
        name: "Engineered oak, herringbone",
        description: "The same oak laid in herringbone with a border.",
        supplier: "Oakwood Floors",
        finish: "Natural oak",
        priceDelta: 3900,
        leadDays: 42,
        swatch: "#B98F5E",
      },
      {
        name: "Luxury vinyl plank",
        description: "Waterproof rigid-core plank in a light oak effect.",
        supplier: "Oakwood Floors",
        finish: "Light oak effect",
        priceDelta: -1200,
        leadDays: 14,
        swatch: "#D6BC95",
      },
    ],
  },
  {
    name: "Sanitaryware",
    room: "Bathroom",
    milestone: "Kitchen & bathrooms",
    description: "Basins, WCs, bath and shower tray across the bathroom and en-suites.",
    status: "chosen",
    chosen: 1,
    notes: "Wall-hung throughout, please — easier to clean underneath.",
    options: [
      {
        name: "Standard white suite",
        description: "Close-coupled WCs, pedestal basins, steel bath.",
        supplier: "Ideal Standard",
        finish: "White",
        priceDelta: 0,
        leadDays: 21,
        standard: true,
        swatch: "#FAFAF8",
      },
      {
        name: "Wall-hung suite",
        description: "Wall-hung WCs and basins on concealed frames.",
        supplier: "Ideal Standard",
        finish: "White",
        priceDelta: 1450,
        leadDays: 35,
        swatch: "#FAFAF8",
      },
    ],
  },
  {
    name: "Kitchen cabinetry",
    room: "Kitchen",
    milestone: "Kitchen & bathrooms",
    description: "Base and wall units, including the island.",
    status: "locked",
    chosen: 1,
    notes: "Confirmed and ordered under change order CO-002.",
    options: [
      {
        name: "Slab-front units",
        description: "Matt slab doors, integrated handles.",
        supplier: "Harwood Kitchens",
        finish: "Matt white",
        priceDelta: 0,
        leadDays: 21,
        standard: true,
        swatch: "#EFEEE9",
      },
      {
        name: "In-frame shaker",
        description: "Painted in-frame shaker units with cup handles.",
        supplier: "Harwood Kitchens",
        finish: "Sage green",
        priceDelta: 8200,
        leadDays: 42,
        swatch: "#8FA08A",
      },
    ],
  },
  {
    name: "Kitchen worktop",
    room: "Kitchen",
    milestone: "Kitchen & bathrooms",
    description: "Worktops and the island top.",
    status: "locked",
    chosen: 1,
    notes: "Confirmed and ordered under change order CO-002.",
    options: [
      {
        name: "Laminate",
        description: "40mm square-edge laminate.",
        supplier: "Harwood Kitchens",
        finish: "Grey stone effect",
        priceDelta: 0,
        leadDays: 14,
        standard: true,
        swatch: "#A7A39C",
      },
      {
        name: "Quartz",
        description: "20mm quartz with a 40mm mitred edge on the island.",
        supplier: "Stoneworks",
        finish: "Calacatta white",
        priceDelta: 6300,
        leadDays: 28,
        swatch: "#EDEAE4",
      },
    ],
  },
  {
    name: "Paint colours",
    room: "Whole house",
    milestone: "Decoration",
    description: "Wall and ceiling colours. Joinery is eggshell to match the doors.",
    status: "open",
    options: [
      {
        name: "Soft white throughout",
        description: "Soft white walls, brilliant white ceilings.",
        supplier: "Farrow & Ball",
        finish: "Estate emulsion",
        priceDelta: 0,
        leadDays: 3,
        standard: true,
        swatch: "#F3F0E6",
      },
      {
        name: "Chosen colour scheme",
        description: "Up to five colours of your choosing, agreed room by room.",
        supplier: "Farrow & Ball",
        finish: "Estate emulsion",
        priceDelta: 650,
        leadDays: 3,
        swatch: "#B7AE92",
      },
    ],
  },
  {
    name: "Driveway surface",
    room: "Driveway",
    milestone: "External works & landscaping",
    description: "The drive and the path to the front door.",
    status: "open",
    options: [
      {
        name: "Tarmac",
        description: "Black tarmac with a brick edging.",
        supplier: "Groundworks Co.",
        finish: "Black",
        priceDelta: 0,
        leadDays: 14,
        standard: true,
        swatch: "#3A3A3A",
      },
      {
        name: "Block paving",
        description: "Charcoal concrete blocks in a herringbone.",
        supplier: "Groundworks Co.",
        finish: "Charcoal",
        priceDelta: 2100,
        leadDays: 21,
        swatch: "#5B5A57",
      },
      {
        name: "Resin-bound gravel",
        description: "Permeable resin-bound gravel in a golden blend.",
        supplier: "Groundworks Co.",
        finish: "Golden gravel",
        priceDelta: 3400,
        leadDays: 21,
        swatch: "#C9A96E",
      },
    ],
  },
];

export function buildBuyerData(input: {
  projectId: string;
  buyerId: string;
  builderId: string;
  milestones: readonly Milestone[];
  updates: readonly Update[];
  referenceDate: Date;
  timeZone: string;
}): BuyerData {
  const { projectId, buyerId, builderId, referenceDate } = input;
  const today = toDateString(referenceDate);
  const hoursAgo = (h: number) => new Date(referenceDate.getTime() - h * 3_600_000).toISOString();
  const milestoneByName = new Map(input.milestones.map((m) => [m.name, m]));

  // ---- Selections ---------------------------------------------------------
  const selectionCategories: SelectionCategory[] = [];
  const selectionOptions: SelectionOption[] = [];

  CATEGORIES.forEach((spec, ci) => {
    const categoryId = stableId("selection", ci);
    const optionIds = spec.options.map((_, oi) => stableId(`option${ci}`, oi));

    spec.options.forEach((o, oi) => {
      selectionOptions.push({
        id: optionIds[oi]!,
        category_id: categoryId,
        project_id: projectId,
        name: o.name,
        description: o.description,
        supplier: o.supplier,
        finish: o.finish,
        price_delta: o.priceDelta,
        lead_time_days: o.leadDays,
        is_standard: o.standard ?? false,
        image_path: null,
        swatch: o.swatch,
        sequence: oi,
        created_at: `${addDays(today, -120)}T09:00:00.000Z`,
      });
    });

    const decided = spec.status !== "open" && spec.chosen !== undefined;
    selectionCategories.push({
      id: categoryId,
      project_id: projectId,
      milestone_id: milestoneByName.get(spec.milestone)?.id ?? null,
      name: spec.name,
      room: spec.room,
      description: spec.description,
      sequence: ci,
      decision_deadline:
        spec.explicitDeadline === undefined ? null : addDays(today, spec.explicitDeadline),
      buffer_days: 7,
      status: spec.status,
      chosen_option_id: decided ? optionIds[spec.chosen!]! : null,
      chosen_by: decided ? buyerId : null,
      chosen_at: decided ? hoursAgo(spec.status === "locked" ? 24 * 44 : 24 * 6) : null,
      notes: spec.notes ?? null,
      created_at: `${addDays(today, -120)}T09:00:00.000Z`,
      updated_at: decided
        ? hoursAgo(spec.status === "locked" ? 24 * 44 : 24 * 6)
        : `${today}T08:00:00.000Z`,
    });
  });

  const categoryByName = new Map(selectionCategories.map((c) => [c.name, c]));
  const updateByTitle = new Map(input.updates.map((u) => [u.title, u]));

  // ---- Questions ------------------------------------------------------------
  interface ThreadSpec {
    title: string;
    kind: Discussion["subject_kind"];
    subjectId: string | null;
    subjectLabel: string | null;
    messages: Array<{ author: string; hoursAgo: number; body: string }>;
  }

  const windowUpdate = updateByTitle.get("Window delivery short by two units");
  const tiles = categoryByName.get("Bathroom wall tiles");

  const threads: ThreadSpec[] = [
    {
      title: "Does the window wait push back the kitchen?",
      kind: "update",
      subjectId: windowUpdate?.id ?? null,
      subjectLabel: windowUpdate?.title ?? null,
      messages: [
        {
          author: buyerId,
          hoursAgo: 72,
          body: "Does the two-week wait on the dormer windows push back the kitchen fitting at all?",
        },
        {
          author: builderId,
          hoursAgo: 50,
          body: "No — the dormers only hold up the rear scaffold and the render on that elevation. The kitchen is inside work that follows plastering, and plastering isn't waiting on them. If the remake slips past the fourteen days I'll tell you the same day.",
        },
      ],
    },
    {
      title: "Can I see the handmade tiles before deciding?",
      kind: "selection",
      subjectId: tiles?.id ?? null,
      subjectLabel: tiles?.name ?? null,
      messages: [
        {
          author: buyerId,
          hoursAgo: 20,
          body: "The zellige tiles look lovely but I'd like to see them in person — is there a showroom, or could a sample come to site for our visit?",
        },
      ],
    },
    {
      title: "When would the EV charger go in?",
      kind: "general",
      subjectId: null,
      subjectLabel: "Change order CO-003",
      messages: [
        {
          author: buyerId,
          hoursAgo: 110,
          body: "If we approve CO-003 now, does the charger go in with the second fix or later?",
        },
        {
          author: builderId,
          hoursAgo: 96,
          body: "With the second fix. If you approve it before the services inspection we can run the cable while the walls are still open, which avoids chasing into finished plaster later.",
        },
      ],
    },
    {
      title: "Parking when we visit",
      kind: "general",
      subjectId: null,
      subjectLabel: null,
      messages: [
        { author: buyerId, hoursAgo: 240, body: "Where should we park when we come for a visit?" },
        {
          author: builderId,
          hoursAgo: 220,
          body: "On Kestrel Rise itself, then walk to the site cabin by the north gate. Please don't use the drive — it's the delivery route and lorries reverse down it.",
        },
      ],
    },
  ];

  const discussions: Discussion[] = [];
  const discussionMessages: DiscussionMessage[] = [];

  threads.forEach((thread, ti) => {
    const threadId = stableId("thread", ti);
    const last = thread.messages[thread.messages.length - 1]!;
    discussions.push({
      id: threadId,
      project_id: projectId,
      subject_kind: thread.kind,
      subject_id: thread.subjectId,
      subject_label: thread.subjectLabel,
      title: thread.title,
      status: last.author === builderId ? "answered" : "open",
      created_by: thread.messages[0]!.author,
      last_message_at: hoursAgo(last.hoursAgo),
      created_at: hoursAgo(thread.messages[0]!.hoursAgo),
      updated_at: hoursAgo(last.hoursAgo),
    });

    thread.messages.forEach((message, mi) => {
      discussionMessages.push({
        id: stableId(`msg${ti}`, mi),
        discussion_id: threadId,
        project_id: projectId,
        author_id: message.author,
        body: message.body,
        created_at: hoursAgo(message.hoursAgo),
      });
    });
  });

  // ---- Site visits ------------------------------------------------------------
  // Upcoming visits are taken from the real slot generator, so the demo can
  // never show a booking at a time the rules would not have offered.
  const slots = availableSlots({ asOf: referenceDate, timeZone: input.timeZone, existing: [] });
  const saturday = slots.find((s) => new Date(`${s.date}T00:00:00Z`).getUTCDay() === 6);
  const laterThursday = slots.filter((s) => new Date(`${s.date}T00:00:00Z`).getUTCDay() === 4)[1];

  // The completed visit comes from the same rules, run from three weeks ago,
  // so it lands on a real session (a Saturday morning) rather than any day.
  const pastSaturday = availableSlots({
    asOf: new Date(referenceDate.getTime() - 21 * 86_400_000),
    timeZone: input.timeZone,
    existing: [],
  }).find((s) => new Date(`${s.date}T00:00:00Z`).getUTCDay() === 6);

  const siteVisits: SiteVisit[] = [
    {
      id: stableId("visit", 0),
      project_id: projectId,
      requested_by: buyerId,
      starts_at: pastSaturday?.startsAt ?? `${addDays(today, -18)}T15:00:00.000Z`,
      duration_minutes: 60,
      purpose: "General look around",
      attendees: 2,
      notes: null,
      status: "completed",
      builder_note: "Good to see you both. Next visit once plastering starts.",
      created_at: hoursAgo(24 * 24),
      updated_at: hoursAgo(24 * 18),
    },
  ];

  if (saturday) {
    siteVisits.push({
      id: stableId("visit", 1),
      project_id: projectId,
      requested_by: buyerId,
      starts_at: saturday.startsAt,
      duration_minutes: 60,
      purpose: "Measure up for furniture",
      attendees: 2,
      notes: "Bringing a laser measure — mainly the living room and main bedroom.",
      status: "confirmed",
      builder_note: "Confirmed. Hard hats and boots are provided at the cabin.",
      created_at: hoursAgo(24 * 4),
      updated_at: hoursAgo(48),
    });
  }

  if (laterThursday) {
    siteVisits.push({
      id: stableId("visit", 2),
      project_id: projectId,
      requested_by: buyerId,
      starts_at: laterThursday.startsAt,
      duration_minutes: 60,
      purpose: "Review selections on site",
      attendees: 1,
      notes: "Would like to see the tile samples against the bathroom walls.",
      status: "requested",
      builder_note: null,
      created_at: hoursAgo(18),
      updated_at: hoursAgo(18),
    });
  }

  // ---- Move-in plan -------------------------------------------------------
  const moveTasks: MoveTask[] = [
    {
      id: stableId("move", 0),
      project_id: projectId,
      user_id: buyerId,
      template_key: "school-places",
      title: null,
      category: null,
      days_before: null,
      done_at: hoursAgo(24 * 20),
      created_at: hoursAgo(24 * 20),
    },
    {
      id: stableId("move", 1),
      project_id: projectId,
      user_id: buyerId,
      template_key: null,
      title: "Arrange a piano tuner for after the move",
      category: "Home",
      days_before: -10,
      done_at: null,
      created_at: hoursAgo(24 * 9),
    },
  ];

  return {
    selectionCategories,
    selectionOptions,
    discussions,
    discussionMessages,
    siteVisits,
    moveTasks,
    buyerLastSeenAt: hoursAgo(24 * 5),
  };
}
