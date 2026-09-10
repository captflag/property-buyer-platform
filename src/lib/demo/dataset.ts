/**
 * The demonstration dataset.
 *
 * This exists so the platform runs, fully populated, with no database and no
 * keys -- `npm run dev` and every screen has real-shaped data behind it. When
 * Supabase is configured the data layer reads the database instead and this
 * module is never touched.
 *
 * Two properties are load-bearing:
 *
 *   1. It is a pure function of a reference date. Nothing calls `Date.now()`
 *      internally, so a server render and its hydration cannot disagree.
 *   2. Randomness comes from a seeded generator, so the same reference date
 *      always produces byte-identical output. "Realistic jitter" that changes
 *      on every render would make every chart flicker and every snapshot test
 *      useless.
 *
 * The narrative is deliberate rather than random: a build that is ~4 points
 * behind plan, carrying one approved change order, a stalled window delivery,
 * and a wet fortnight in April. Flat, happy data hides exactly the bugs a
 * dashboard exists to surface.
 */

import { buildBuyerData } from "@/lib/demo/buyer-data";
import { addDays, toDateString } from "@/lib/format";
import type {
  ActivityLogEntry,
  AppNotification,
  BudgetCategory,
  ChangeOrder,
  ColourSlot,
  CostEntry,
  DrawRequest,
  Inspection,
  Issue,
  Discussion,
  DiscussionMessage,
  Milestone,
  MilestoneDependency,
  MoveTask,
  Organization,
  Payment,
  Phase,
  Profile,
  Project,
  ProjectDocument,
  ProjectMember,
  ProgressSnapshot,
  SelectionCategory,
  SelectionOption,
  SiteVisit,
  Update,
  UpdateMedia,
  WeatherLogEntry,
} from "@/types/database";

/** Deterministic PRNG (mulberry32). Same seed, same sequence, always. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const BUYER_ID = "33333333-3333-4333-8333-333333333331";
const BUILDER_ID = "33333333-3333-4333-8333-333333333332";
const ARCHITECT_ID = "33333333-3333-4333-8333-333333333333";
const INSPECTOR_ID = "33333333-3333-4333-8333-333333333334";

/**
 * The programme is 410 days long and the reference date sits 232 days into it.
 * Both are relative to `referenceDate` rather than fixed, so the example stays
 * mid-build however long after writing this it is run -- a hard-coded start
 * would have the house finished within the year.
 *
 * Day 232 is chosen deliberately: it puts the build just past weather-tight
 * with services first fix underway, which is the point the seeded site updates
 * describe.
 */
const PROGRAMME_DAYS = 410;
const ELAPSED_DAYS = 232;
const CONTRACT_VALUE = 685_000;

/** Stable pseudo-uuid so ids stay readable in the DOM while looking real. */
function id(kind: string, n: number): string {
  const suffix = String(n).padStart(4, "0");
  const kindHash = [...kind].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 0xffff, 7);
  const block = kindHash.toString(16).padStart(4, "0");
  return `${block}${suffix}-0000-4000-8000-${block}${suffix}0000`;
}

export interface DemoDataset {
  organization: Organization;
  project: Project;
  profiles: Profile[];
  members: ProjectMember[];
  phases: Phase[];
  milestones: Milestone[];
  dependencies: MilestoneDependency[];
  updates: Update[];
  media: UpdateMedia[];
  documents: ProjectDocument[];
  budgetCategories: BudgetCategory[];
  costEntries: CostEntry[];
  payments: Payment[];
  drawRequests: DrawRequest[];
  changeOrders: ChangeOrder[];
  inspections: Inspection[];
  issues: Issue[];
  snapshots: ProgressSnapshot[];
  weather: WeatherLogEntry[];
  notifications: AppNotification[];
  activity: ActivityLogEntry[];
  selectionCategories: SelectionCategory[];
  selectionOptions: SelectionOption[];
  discussions: Discussion[];
  discussionMessages: DiscussionMessage[];
  siteVisits: SiteVisit[];
  moveTasks: MoveTask[];
}

interface PhaseSpec {
  name: string;
  description: string;
  weight: number;
  colourSlot: ColourSlot;
  milestones: MilestoneSpec[];
}

interface MilestoneSpec {
  name: string;
  description: string;
  /** Offset in days from project start. */
  offset: number;
  duration: number;
  weight: number;
  progress: number;
  paymentPercent?: number;
  /** Index of the preceding milestone in the flattened list, if not the previous one. */
  after?: string;
  lag?: number;
}

const PHASE_SPECS: PhaseSpec[] = [
  {
    name: "Site & Foundations",
    description: "Clearing, excavation, footings and the slab pour.",
    weight: 15,
    colourSlot: 1,
    milestones: [
      {
        name: "Site mobilisation",
        description: "Hoarding, site office, temporary power and water connections established.",
        offset: 0,
        duration: 12,
        weight: 2,
        progress: 100,
      },
      {
        name: "Excavation & earthworks",
        description: "Bulk excavation to formation level, soil removed and spoil carted away.",
        offset: 12,
        duration: 18,
        weight: 3,
        progress: 100,
      },
      {
        name: "Footings & reinforcement",
        description: "Trench footings poured and steel reinforcement cage tied and inspected.",
        offset: 30,
        duration: 20,
        weight: 4,
        progress: 100,
        paymentPercent: 10,
      },
      {
        name: "Slab pour & cure",
        description: "Ground floor slab poured in a single continuous pour and cured for 28 days.",
        offset: 50,
        duration: 26,
        weight: 6,
        progress: 100,
        paymentPercent: 10,
      },
    ],
  },
  {
    name: "Structure & Framing",
    description: "Load-bearing structure, floor decks and roof trusses.",
    weight: 20,
    colourSlot: 2,
    milestones: [
      {
        name: "Ground floor framing",
        description:
          "External and internal load-bearing walls framed to ground floor ceiling height.",
        offset: 76,
        duration: 24,
        weight: 6,
        progress: 100,
      },
      {
        name: "First floor deck",
        description: "Engineered joists and structural deck installed over the ground floor.",
        offset: 100,
        duration: 16,
        weight: 4,
        progress: 100,
      },
      {
        name: "First floor framing",
        description: "Upper storey walls framed, openings formed for windows and doors.",
        offset: 116,
        duration: 22,
        weight: 5,
        progress: 100,
        paymentPercent: 15,
      },
      {
        name: "Roof trusses & bracing",
        description: "Prefabricated trusses craned in, braced and tied down to the wall plates.",
        offset: 138,
        duration: 18,
        weight: 5,
        progress: 100,
      },
    ],
  },
  {
    name: "Envelope & Roofing",
    description: "Making the building weather-tight.",
    weight: 15,
    colourSlot: 3,
    milestones: [
      {
        name: "Roof covering",
        description: "Membrane, battens and concrete tiles laid; ridge and valleys detailed.",
        offset: 156,
        duration: 20,
        weight: 5,
        progress: 100,
      },
      {
        name: "External sheathing & wrap",
        description: "Structural sheathing and breathable weather barrier fixed to all elevations.",
        offset: 170,
        duration: 14,
        weight: 3,
        progress: 100,
      },
      {
        name: "Windows & external doors",
        description: "Double-glazed aluminium-clad units installed and sealed.",
        offset: 184,
        duration: 22,
        weight: 4,
        progress: 72,
        paymentPercent: 15,
      },
      {
        name: "Cladding & render",
        description: "Brick slip cladding to front elevation, silicone render to remaining faces.",
        offset: 200,
        duration: 28,
        weight: 3,
        progress: 45,
      },
    ],
  },
  {
    name: "MEP Rough-In",
    description: "Mechanical, electrical and plumbing first fix.",
    weight: 15,
    colourSlot: 4,
    milestones: [
      {
        name: "Electrical first fix",
        description: "Cable runs, back boxes and consumer unit position set out through the frame.",
        offset: 206,
        duration: 20,
        weight: 4,
        progress: 88,
      },
      {
        name: "Plumbing first fix",
        description: "Hot and cold distribution, waste stacks and underfloor heating manifolds.",
        offset: 212,
        duration: 22,
        weight: 4,
        progress: 76,
      },
      {
        name: "HVAC installation",
        description: "Air source heat pump sited, ductwork and MVHR runs installed.",
        offset: 222,
        duration: 24,
        weight: 4,
        progress: 40,
      },
      {
        name: "MEP inspection",
        description: "Third-party inspection of all first-fix services before close-up.",
        offset: 246,
        duration: 6,
        weight: 3,
        progress: 0,
        paymentPercent: 15,
      },
    ],
  },
  {
    name: "Interior Fit-Out",
    description: "From insulation and plaster through to second fix and decoration.",
    weight: 25,
    colourSlot: 5,
    milestones: [
      {
        name: "Insulation & airtightness",
        description: "Mineral wool to walls, blown insulation to loft, tapes and membranes sealed.",
        offset: 252,
        duration: 16,
        weight: 4,
        progress: 0,
      },
      {
        name: "Plasterboard & skim",
        description: "Boarding to walls and ceilings, taped, jointed and skim finished.",
        offset: 268,
        duration: 24,
        weight: 5,
        progress: 0,
      },
      {
        name: "Joinery & staircase",
        description: "Internal doors, architrave, skirting and the oak staircase installed.",
        offset: 292,
        duration: 22,
        weight: 4,
        progress: 0,
      },
      {
        name: "Kitchen & bathrooms",
        description: "Cabinetry, worktops, sanitaryware and tiling to wet areas.",
        offset: 306,
        duration: 26,
        weight: 6,
        progress: 0,
        paymentPercent: 20,
      },
      {
        name: "Flooring",
        description:
          "Engineered oak to living areas, porcelain tile to wet rooms, carpet to bedrooms.",
        offset: 326,
        duration: 18,
        weight: 3,
        progress: 0,
      },
      {
        name: "Decoration",
        description: "Mist coat, two finish coats throughout and eggshell to all joinery.",
        offset: 338,
        duration: 20,
        weight: 3,
        progress: 0,
      },
    ],
  },
  {
    name: "Handover & Landscaping",
    description: "Commissioning, snagging, external works and keys.",
    weight: 10,
    colourSlot: 7,
    milestones: [
      {
        name: "MEP second fix & commissioning",
        description: "Fittings, sockets, controls and heat pump commissioned and balanced.",
        offset: 352,
        duration: 16,
        weight: 3,
        progress: 0,
      },
      {
        name: "External works & landscaping",
        description: "Driveway, patio, turf, planting and boundary fencing completed.",
        offset: 358,
        duration: 24,
        weight: 3,
        progress: 0,
      },
      {
        name: "Snagging & rectification",
        description: "Joint inspection with the buyer, defects listed and closed out.",
        offset: 382,
        duration: 18,
        weight: 2,
        progress: 0,
      },
      {
        name: "Final inspection & handover",
        description: "Building control sign-off, warranties issued and keys released.",
        offset: 400,
        duration: 10,
        weight: 2,
        progress: 0,
        paymentPercent: 15,
      },
    ],
  },
];

export function buildDemoDataset(referenceDate: Date = new Date()): DemoDataset {
  const random = rng(20260909);
  const today = toDateString(referenceDate);
  const START_DATE = addDays(today, -ELAPSED_DAYS);
  const TARGET_DATE = addDays(START_DATE, PROGRAMME_DAYS);

  const organization: Organization = {
    id: ORG_ID,
    name: "Calder & Finch Construction",
    slug: "calder-finch",
    logo_url: null,
    website: "https://calderfinch.example",
    phone: "+1 512 555 0142",
    email: "site@calderfinch.example",
    created_at: `${START_DATE}T09:00:00.000Z`,
    updated_at: `${START_DATE}T09:00:00.000Z`,
  };

  const project: Project = {
    id: PROJECT_ID,
    organization_id: ORG_ID,
    name: "Kestrel House",
    slug: "kestrel-house",
    description:
      "A four-bedroom detached family home on a quarter-acre plot, built to a fabric-first specification with an air source heat pump and mechanical ventilation with heat recovery.",
    cover_image_url: null,
    status: "in_progress",
    address_line1: "17 Kestrel Rise",
    address_line2: "Aster Grove",
    city: "Austin",
    state: "TX",
    postal_code: "78704",
    country: "US",
    timezone: "America/Chicago",
    latitude: 30.2489,
    longitude: -97.7681,
    start_date: START_DATE,
    target_completion_date: TARGET_DATE,
    actual_completion_date: null,
    handover_date: null,
    contract_value: CONTRACT_VALUE,
    currency: "USD",
    unit_type: "Detached house",
    floor_area_sqft: 2840,
    bedrooms: 4,
    bathrooms: 3.5,
    plot_area_sqft: 10890,
    contractor_name: "Calder & Finch Construction",
    architect_name: "Wren Lassiter Architects",
    site_manager_name: "Marcus Adeyemi",
    site_manager_phone: "+1 512 555 0177",
    created_at: `${START_DATE}T09:00:00.000Z`,
    updated_at: `${today}T08:00:00.000Z`,
  };

  const profiles: Profile[] = [
    {
      id: BUYER_ID,
      email: "amara.okafor@example.com",
      full_name: "Amara Okafor",
      avatar_url: null,
      phone: "+1 512 555 0198",
      role: "buyer",
      locale: "en",
      timezone: "America/Chicago",
      onboarded_at: `${START_DATE}T10:00:00.000Z`,
      created_at: `${START_DATE}T10:00:00.000Z`,
      updated_at: `${START_DATE}T10:00:00.000Z`,
    },
    {
      id: BUILDER_ID,
      email: "marcus.adeyemi@calderfinch.example",
      full_name: "Marcus Adeyemi",
      avatar_url: null,
      phone: "+1 512 555 0177",
      role: "builder",
      locale: "en",
      timezone: "America/Chicago",
      onboarded_at: `${START_DATE}T09:00:00.000Z`,
      created_at: `${START_DATE}T09:00:00.000Z`,
      updated_at: `${START_DATE}T09:00:00.000Z`,
    },
    {
      id: ARCHITECT_ID,
      email: "wren@wrenlassiter.example",
      full_name: "Wren Lassiter",
      avatar_url: null,
      phone: null,
      role: "builder",
      locale: "en",
      timezone: "America/Chicago",
      onboarded_at: `${START_DATE}T09:00:00.000Z`,
      created_at: `${START_DATE}T09:00:00.000Z`,
      updated_at: `${START_DATE}T09:00:00.000Z`,
    },
    {
      id: INSPECTOR_ID,
      email: "d.halloran@buildingcontrol.example",
      full_name: "Deirdre Halloran",
      avatar_url: null,
      phone: null,
      role: "builder",
      locale: "en",
      timezone: "America/Chicago",
      onboarded_at: `${START_DATE}T09:00:00.000Z`,
      created_at: `${START_DATE}T09:00:00.000Z`,
      updated_at: `${START_DATE}T09:00:00.000Z`,
    },
  ];

  const members: ProjectMember[] = [
    {
      project_id: PROJECT_ID,
      user_id: BUYER_ID,
      role: "buyer",
      is_primary: true,
      last_seen_at: null,
      created_at: `${START_DATE}T10:00:00.000Z`,
    },
    {
      project_id: PROJECT_ID,
      user_id: BUILDER_ID,
      role: "builder",
      is_primary: true,
      last_seen_at: null,
      created_at: `${START_DATE}T09:00:00.000Z`,
    },
    {
      project_id: PROJECT_ID,
      user_id: ARCHITECT_ID,
      role: "builder",
      is_primary: false,
      last_seen_at: null,
      created_at: `${START_DATE}T09:00:00.000Z`,
    },
    {
      project_id: PROJECT_ID,
      user_id: INSPECTOR_ID,
      role: "inspector",
      is_primary: false,
      last_seen_at: null,
      created_at: `${START_DATE}T09:00:00.000Z`,
    },
  ];

  // ---- Phases and milestones -----------------------------------------------
  const phases: Phase[] = [];
  const milestones: Milestone[] = [];
  const dependencies: MilestoneDependency[] = [];

  let milestoneIndex = 0;

  PHASE_SPECS.forEach((spec, phaseIdx) => {
    const phaseId = id("phase", phaseIdx);
    const firstOffset = spec.milestones[0]!.offset;
    const lastSpec = spec.milestones[spec.milestones.length - 1]!;
    const lastOffset = lastSpec.offset + lastSpec.duration;

    const allDone = spec.milestones.every((m) => m.progress === 100);
    const anyStarted = spec.milestones.some((m) => m.progress > 0);

    phases.push({
      id: phaseId,
      project_id: PROJECT_ID,
      name: spec.name,
      description: spec.description,
      sequence: phaseIdx + 1,
      weight: spec.weight,
      colour_slot: spec.colourSlot,
      planned_start: addDays(START_DATE, firstOffset),
      planned_end: addDays(START_DATE, lastOffset),
      actual_start: anyStarted ? addDays(START_DATE, firstOffset + 1) : null,
      actual_end: allDone ? addDays(START_DATE, lastOffset + 2) : null,
      status: allDone ? "completed" : anyStarted ? "in_progress" : "not_started",
      created_at: `${START_DATE}T09:00:00.000Z`,
      updated_at: `${today}T08:00:00.000Z`,
    });

    for (const ms of spec.milestones) {
      const msId = id("milestone", milestoneIndex);
      const plannedStart = addDays(START_DATE, ms.offset);
      const plannedEnd = addDays(START_DATE, ms.offset + ms.duration);

      const status: Milestone["status"] =
        ms.progress === 100 ? "completed" : ms.progress > 0 ? "in_progress" : "not_started";

      // Completed work drifted a little: early phases ran to plan, later ones
      // picked up the delay that puts the project behind today.
      const drift = ms.progress === 100 ? Math.round((random() * 6 - 1) * (ms.offset / 200)) : 0;

      milestones.push({
        id: msId,
        project_id: PROJECT_ID,
        phase_id: phaseId,
        name: ms.name,
        description: ms.description,
        sequence: milestoneIndex + 1,
        weight: ms.weight,
        planned_start: plannedStart,
        planned_end: plannedEnd,
        actual_start: ms.progress > 0 ? addDays(plannedStart, Math.max(0, drift)) : null,
        actual_end: ms.progress === 100 ? addDays(plannedEnd, drift) : null,
        progress_percent: ms.progress,
        status,
        is_critical: false, // computed by computeSchedule(), never asserted here
        payment_percent: ms.paymentPercent ?? 0,
        created_at: `${START_DATE}T09:00:00.000Z`,
        updated_at: `${today}T08:00:00.000Z`,
      });

      milestoneIndex += 1;
    }
  });

  // Dependencies are derived from the planned dates rather than chained
  // blindly, because a straight finish-to-start chain would make every single
  // milestone critical and the critical path would tell the reader nothing.
  //
  // The rule is the standard one: a milestone's immediate predecessors are the
  // latest-finishing milestones that end on or before it starts. Work planned
  // to run in parallel therefore hangs off a shared predecessor, and the
  // shorter branches acquire real float -- which is exactly what a Gantt chart
  // is for.
  const byName = new Map(milestones.map((m) => [m.name, m.id]));

  for (const successor of milestones) {
    const candidates = milestones.filter(
      (m) => m.id !== successor.id && m.planned_end <= successor.planned_start,
    );
    if (candidates.length === 0) continue;

    const latestEnd = candidates.reduce(
      (latest, m) => (m.planned_end > latest ? m.planned_end : latest),
      candidates[0]!.planned_end,
    );

    for (const predecessor of candidates.filter((m) => m.planned_end === latestEnd)) {
      dependencies.push({
        predecessor_id: predecessor.id,
        successor_id: successor.id,
        type: "FS",
        lag_days: 0,
      });
    }
  }

  // Two genuine overlaps the date rule cannot see, because the tasks run
  // concurrently rather than one after the other.
  const overlaps: Array<[string, string, MilestoneDependency["type"], number]> = [
    ["Windows & external doors", "Cladding & render", "SS", 16],
    ["Kitchen & bathrooms", "Flooring", "SS", 20],
  ];
  for (const [from, to, type, lag] of overlaps) {
    const predecessor = byName.get(from);
    const successor = byName.get(to);
    if (!predecessor || !successor) continue;
    dependencies.push({
      predecessor_id: predecessor,
      successor_id: successor,
      type,
      lag_days: lag,
    });
  }

  // ---- Construction updates ------------------------------------------------
  const UPDATE_SPECS: Array<{
    daysAgo: number;
    title: string;
    body: string;
    milestone: string;
    status: Update["status"];
    weather: string;
    temp: number;
    crew: number;
    hours: number;
    delta?: number;
    photos?: number;
  }> = [
    {
      daysAgo: 1,
      title: "Heat pump slab poured, MVHR ducting set out",
      body: "The condenser slab to the north elevation went in first thing and has been protected overnight. Ductwork for the heat recovery system is set out through the first floor joists and will be fixed tomorrow once the electrician has finished his runs in the same voids. No conflicts found on the coordination walk this morning.",
      milestone: "HVAC installation",
      status: "in_progress",
      weather: "Clear",
      temp: 24,
      crew: 6,
      hours: 48,
      delta: 4,
      photos: 2,
    },
    {
      daysAgo: 3,
      title: "Underfloor heating manifolds mounted",
      body: "Both manifolds are mounted and labelled — ground floor in the plant cupboard, first floor in the airing cupboard. Circuits are pressure tested to 6 bar and holding. We will leave them under test until the screed goes down so any nail strike during boarding shows up immediately.",
      milestone: "Plumbing first fix",
      status: "in_progress",
      weather: "Partly cloudy",
      temp: 22,
      crew: 4,
      hours: 32,
      delta: 6,
      photos: 1,
    },
    {
      daysAgo: 6,
      title: "Window delivery short by two units",
      body: "The glazing delivery arrived with the two rear dormer units missing — the supplier has confirmed a manufacturing fault on the frames and is remaking them. Revised delivery is fourteen days out. We have sheeted both openings and this does not stop the cladding starting on the front and side elevations, but it does hold the rear scaffold up. Logged as an issue and being chased daily.",
      milestone: "Windows & external doors",
      status: "blocked",
      weather: "Overcast",
      temp: 19,
      crew: 3,
      hours: 21,
      photos: 1,
    },
    {
      daysAgo: 9,
      title: "Electrical first fix past the halfway mark",
      body: "Cable runs are complete to the whole of the ground floor and to three of the four bedrooms. Consumer unit position has been moved 400mm along the utility wall to clear the MVHR unit — architect has approved the change on site and it does not affect the layout drawings.",
      milestone: "Electrical first fix",
      status: "in_progress",
      weather: "Clear",
      temp: 26,
      crew: 3,
      hours: 24,
      delta: 12,
      photos: 2,
    },
    {
      daysAgo: 13,
      title: "Front elevation brick slips started",
      body: "Setting out is complete and the first three courses of brick slips are on to the front elevation. The blend is a good match to the approved sample panel — worth a look on your next visit while the sample board is still on site for comparison.",
      milestone: "Cladding & render",
      status: "in_progress",
      weather: "Clear",
      temp: 28,
      crew: 4,
      hours: 36,
      delta: 15,
      photos: 3,
    },
    {
      daysAgo: 18,
      title: "Airtightness pre-test: 3.2 ach",
      body: "We ran an early blower door test before close-up so any leaks are still reachable. Result is 3.2 air changes per hour against a target of 3.0, with the losses concentrated at the ground floor service penetrations. Those are being taped this week and we expect the formal test to come in comfortably under target.",
      milestone: "External sheathing & wrap",
      status: "completed",
      weather: "Partly cloudy",
      temp: 25,
      crew: 2,
      hours: 12,
      photos: 1,
    },
    {
      daysAgo: 24,
      title: "Roof signed off by building control",
      body: "Deirdre attended for the roof inspection and signed it off without conditions. Tile fixing, ridge ventilation and the valley detailing were all noted as compliant. Certificate is in your document library.",
      milestone: "Roof covering",
      status: "completed",
      weather: "Clear",
      temp: 27,
      crew: 5,
      hours: 40,
      photos: 2,
    },
    {
      daysAgo: 31,
      title: "Scaffold adapted for cladding",
      body: "The scaffold has been adapted and re-tagged to give a working lift at cladding height on all four elevations. Handover certificate from the scaffolder is filed. Please keep to the marked walkway on the north side when visiting.",
      milestone: "Cladding & render",
      status: "in_progress",
      weather: "Overcast",
      temp: 21,
      crew: 4,
      hours: 30,
      photos: 1,
    },
    {
      daysAgo: 39,
      title: "Roof covering complete",
      body: "All tiling, ridge and hip work is finished and the building is now weather-tight. This is the milestone the rest of the internal programme has been waiting on, and it means the fit-out trades can work regardless of weather from here.",
      milestone: "Roof covering",
      status: "completed",
      weather: "Clear",
      temp: 29,
      crew: 6,
      hours: 48,
      delta: 30,
      photos: 3,
    },
    {
      daysAgo: 52,
      title: "Trusses craned in and braced",
      body: "All twenty-two trusses were craned in across a single day and are now fully braced and strapped down to the wall plates. The crane went well and we were off the road inside the permitted window.",
      milestone: "Roof trusses & bracing",
      status: "completed",
      weather: "Clear",
      temp: 26,
      crew: 7,
      hours: 56,
      photos: 2,
    },
    {
      daysAgo: 68,
      title: "First floor framing complete, payment stage reached",
      body: "Upper storey framing is complete with all openings formed and checked against the schedule. This closes out the framing payment stage — the invoice will follow separately.",
      milestone: "First floor framing",
      status: "completed",
      weather: "Partly cloudy",
      temp: 24,
      crew: 6,
      hours: 48,
      photos: 2,
    },
    {
      daysAgo: 96,
      title: "Wet fortnight has cost us four days",
      body: "The last two weeks have been persistently wet and we have lost four working days on external work. Framing has continued under temporary cover where it could. We are carrying the delay rather than absorbing it into the float, and it is reflected in the revised programme.",
      milestone: "Ground floor framing",
      status: "in_progress",
      weather: "Heavy rain",
      temp: 16,
      crew: 3,
      hours: 18,
      photos: 1,
    },
    {
      daysAgo: 128,
      title: "Slab cured and tested",
      body: "The slab has reached its 28-day strength and the cube tests came back above specification. The structural engineer has issued his certificate and it is in your documents.",
      milestone: "Slab pour & cure",
      status: "completed",
      weather: "Clear",
      temp: 20,
      crew: 2,
      hours: 10,
      photos: 2,
    },
    {
      daysAgo: 168,
      title: "Slab poured in a single continuous pour",
      body: "The ground floor slab went in as one continuous pour starting at 6am. Nine loads, finished and power floated by late afternoon. A single pour avoids a cold joint through the middle of the floor, which is why we scheduled it this way.",
      milestone: "Slab pour & cure",
      status: "completed",
      weather: "Clear",
      temp: 18,
      crew: 9,
      hours: 81,
      photos: 3,
    },
  ];

  const updates: Update[] = [];
  const media: UpdateMedia[] = [];

  UPDATE_SPECS.forEach((spec, i) => {
    const updateId = id("update", i);
    const publishedAt = addDays(today, -spec.daysAgo);
    updates.push({
      id: updateId,
      project_id: PROJECT_ID,
      milestone_id: byName.get(spec.milestone) ?? null,
      author_id: BUILDER_ID,
      title: spec.title,
      body: spec.body,
      status: spec.status,
      progress_delta: spec.delta ?? null,
      crew_size: spec.crew,
      hours_worked: spec.hours,
      weather: spec.weather,
      temperature_c: spec.temp,
      is_published: true,
      published_at: `${publishedAt}T16:30:00.000Z`,
      created_at: `${publishedAt}T16:30:00.000Z`,
      updated_at: `${publishedAt}T16:30:00.000Z`,
    });

    for (let p = 0; p < (spec.photos ?? 0); p += 1) {
      media.push({
        id: id(`media${i}`, p),
        update_id: updateId,
        project_id: PROJECT_ID,
        storage_path: `${PROJECT_ID}/updates/${updateId}/${p}.jpg`,
        kind: "image",
        caption: null,
        width: 1600,
        height: 1067,
        sort: p,
        created_at: `${publishedAt}T16:30:00.000Z`,
      });
    }
  });

  // ---- Documents -----------------------------------------------------------
  const DOC_SPECS: Array<[string, ProjectDocument["category"], number, number, boolean, boolean]> =
    [
      ["Building permit — BP-2025-4471", "permit", 2_411_000, 0, false, false],
      ["Architectural drawings — Rev C", "blueprint", 18_204_000, 14, false, false],
      ["Structural engineer's calculations", "blueprint", 6_120_000, 12, false, false],
      ["Construction contract (executed)", "contract", 1_842_000, 2, true, false],
      ["Slab cube test certificate", "certificate", 428_000, 128, false, false],
      ["Roof inspection certificate", "certificate", 512_000, 24, false, false],
      ["Scaffold handover certificate", "certificate", 366_000, 31, false, false],
      ["Change order CO-002 — kitchen upgrade", "contract", 704_000, 46, true, false],
      ["Payment schedule (revised)", "invoice", 288_000, 46, false, false],
      ["Invoice INV-0041 — framing stage", "invoice", 194_000, 66, false, false],
      ["Site insurance certificate", "insurance", 622_000, 1, false, false],
      ["Airtightness pre-test report", "report", 1_106_000, 18, false, false],
      ["Heat pump warranty registration", "warranty", 480_000, 3, false, false],
      ["Subcontractor rates schedule", "contract", 340_000, 90, false, true],
    ];

  const documents: ProjectDocument[] = DOC_SPECS.map(
    ([name, category, size, daysAgo, requiresAck, confidential], i) => ({
      id: id("document", i),
      project_id: PROJECT_ID,
      name,
      description: null,
      category,
      storage_path: `${PROJECT_ID}/documents/${id("document", i)}.pdf`,
      mime_type: "application/pdf",
      size_bytes: size,
      version: 1,
      supersedes_id: null,
      uploaded_by: BUILDER_ID,
      issued_at: addDays(today, -daysAgo),
      expires_at: category === "insurance" ? addDays(today, 210) : null,
      requires_ack: requiresAck,
      is_confidential: confidential,
      created_at: `${addDays(today, -daysAgo)}T11:00:00.000Z`,
      updated_at: `${addDays(today, -daysAgo)}T11:00:00.000Z`,
    }),
  );

  // ---- Budget and costs ----------------------------------------------------
  const BUDGET_SPECS: Array<[string, string, number, ColourSlot]> = [
    ["Substructure", "SUB", 84_000, 1],
    ["Superstructure", "SUP", 156_000, 2],
    ["Envelope & roofing", "ENV", 112_000, 3],
    ["Mechanical & electrical", "MEP", 98_000, 4],
    ["Internal finishes", "FIN", 124_000, 5],
    ["External works", "EXT", 46_000, 6],
    ["Professional fees", "FEE", 38_000, 7],
    ["Contingency", "CON", 27_000, 8],
  ];

  const budgetCategories: BudgetCategory[] = BUDGET_SPECS.map(
    ([name, code, budgeted, colourSlot], i) => ({
      id: id("budget", i),
      project_id: PROJECT_ID,
      name,
      code,
      budgeted_amount: budgeted,
      sequence: i,
      colour_slot: colourSlot,
      created_at: `${START_DATE}T09:00:00.000Z`,
    }),
  );

  // Spend profile per category: [actual share, committed share] of budget.
  // Envelope is deliberately over — the story the dashboard has to surface.
  const SPEND_PROFILE: Array<[number, number]> = [
    [1.0, 0], // Substructure — done, on budget
    [0.98, 0], // Superstructure — done, marginally under
    [0.82, 0.24], // Envelope — over once commitments land
    [0.44, 0.31], // MEP — in progress
    [0.05, 0.18], // Finishes — barely started, orders placed
    [0.0, 0.06], // External works
    [0.71, 0.1], // Fees
    [0.34, 0.0], // Contingency — partly drawn
  ];

  const costEntries: CostEntry[] = [];
  budgetCategories.forEach((category, i) => {
    const [actualShare, committedShare] = SPEND_PROFILE[i]!;
    const actual = Math.round(category.budgeted_amount * actualShare);
    const committed = Math.round(category.budgeted_amount * committedShare);

    // Split each total into a few dated entries so the cash-flow chart has shape.
    const parts = Math.max(1, Math.round(2 + random() * 3));
    for (let p = 0; p < parts && actual > 0; p += 1) {
      costEntries.push({
        id: id(`cost-a${i}`, p),
        project_id: PROJECT_ID,
        category_id: category.id,
        milestone_id: null,
        description: `${category.name} — valuation ${p + 1}`,
        amount: Math.round(actual / parts),
        kind: "actual",
        incurred_on: addDays(START_DATE, Math.round(20 + (300 / parts) * p + random() * 15)),
        vendor: organization.name,
        created_by: BUILDER_ID,
        created_at: `${START_DATE}T09:00:00.000Z`,
      });
    }
    if (committed > 0) {
      costEntries.push({
        id: id(`cost-c${i}`, 0),
        project_id: PROJECT_ID,
        category_id: category.id,
        milestone_id: null,
        description: `${category.name} — placed orders`,
        amount: committed,
        kind: "committed",
        incurred_on: addDays(today, -Math.round(random() * 40)),
        vendor: "Various",
        created_by: BUILDER_ID,
        created_at: `${today}T09:00:00.000Z`,
      });
    }
  });

  // ---- Payments ------------------------------------------------------------
  const PAYMENT_SPECS: Array<[string, number, number, Payment["status"], string | null]> = [
    ["Deposit on signing", 10, -320, "paid", "INV-0012"],
    ["Foundations complete", 10, -240, "paid", "INV-0021"],
    ["Framing complete", 15, -66, "paid", "INV-0041"],
    ["Weather-tight", 15, -8, "invoiced", "INV-0058"],
    ["Services first fix signed off", 15, 34, "scheduled", null],
    ["Second fix complete", 20, 128, "scheduled", null],
    ["Practical completion & handover", 15, 196, "scheduled", null],
  ];

  const payments: Payment[] = PAYMENT_SPECS.map(
    ([name, percent, dayOffset, status, invoice], i) => ({
      id: id("payment", i),
      project_id: PROJECT_ID,
      milestone_id: null,
      name,
      sequence: i,
      amount: Math.round((CONTRACT_VALUE * percent) / 100),
      percent_of_contract: percent,
      due_date: addDays(today, dayOffset),
      status,
      paid_at: status === "paid" ? `${addDays(today, dayOffset + 3)}T12:00:00.000Z` : null,
      invoice_number: invoice,
      method: status === "paid" ? "Bank transfer" : null,
      reference: null,
      notes: null,
      created_at: `${START_DATE}T09:00:00.000Z`,
      updated_at: `${today}T09:00:00.000Z`,
    }),
  );

  const drawRequests: DrawRequest[] = [
    {
      id: id("draw", 0),
      project_id: PROJECT_ID,
      milestone_id: byName.get("Windows & external doors") ?? null,
      payment_id: payments[3]!.id,
      reference: "DR-0004",
      amount: 102_750,
      status: "under_review",
      justification:
        "Weather-tight stage substantially reached. Two rear dormer units outstanding pending supplier remake; value of those units withheld from this draw.",
      requested_by: BUILDER_ID,
      submitted_at: `${addDays(today, -5)}T10:00:00.000Z`,
      decided_at: null,
      decided_by: null,
      decision_note: null,
      created_at: `${addDays(today, -5)}T10:00:00.000Z`,
      updated_at: `${addDays(today, -5)}T10:00:00.000Z`,
    },
    {
      id: id("draw", 1),
      project_id: PROJECT_ID,
      milestone_id: byName.get("First floor framing") ?? null,
      payment_id: payments[2]!.id,
      reference: "DR-0003",
      amount: 102_750,
      status: "paid",
      justification: "Framing stage complete and inspected.",
      requested_by: BUILDER_ID,
      submitted_at: `${addDays(today, -70)}T10:00:00.000Z`,
      decided_at: `${addDays(today, -66)}T14:00:00.000Z`,
      decided_by: BUYER_ID,
      decision_note: "Approved following site walk on the 4th.",
      created_at: `${addDays(today, -70)}T10:00:00.000Z`,
      updated_at: `${addDays(today, -63)}T10:00:00.000Z`,
    },
    {
      id: id("draw", 2),
      project_id: PROJECT_ID,
      milestone_id: null,
      payment_id: null,
      reference: "DR-0005",
      amount: 18_400,
      status: "draft",
      justification: "Materials on site for internal joinery — awaiting delivery note.",
      requested_by: BUILDER_ID,
      submitted_at: null,
      decided_at: null,
      decided_by: null,
      decision_note: null,
      created_at: `${addDays(today, -2)}T09:00:00.000Z`,
      updated_at: `${addDays(today, -2)}T09:00:00.000Z`,
    },
  ];

  const changeOrders: ChangeOrder[] = [
    {
      id: id("change", 0),
      project_id: PROJECT_ID,
      number: "CO-001",
      title: "Upgrade to triple glazing on north elevation",
      description:
        "Buyer-requested upgrade from double to triple glazed units on the three north-facing windows to reduce heat loss on the coldest elevation.",
      cost_delta: 6_800,
      schedule_delta_days: 0,
      status: "approved",
      requested_by: BUYER_ID,
      decided_by: BUILDER_ID,
      decided_at: `${addDays(today, -142)}T10:00:00.000Z`,
      created_at: `${addDays(today, -150)}T10:00:00.000Z`,
      updated_at: `${addDays(today, -142)}T10:00:00.000Z`,
    },
    {
      id: id("change", 1),
      project_id: PROJECT_ID,
      number: "CO-002",
      title: "Kitchen specification upgrade",
      description:
        "Change from the standard cabinetry range to the specified in-frame shaker units with quartz worktops, including the associated appliance changes.",
      cost_delta: 14_500,
      schedule_delta_days: 6,
      status: "approved",
      requested_by: BUYER_ID,
      decided_by: BUILDER_ID,
      decided_at: `${addDays(today, -44)}T10:00:00.000Z`,
      created_at: `${addDays(today, -52)}T10:00:00.000Z`,
      updated_at: `${addDays(today, -44)}T10:00:00.000Z`,
    },
    {
      id: id("change", 2),
      project_id: PROJECT_ID,
      number: "CO-003",
      title: "EV charger and consumer unit upgrade",
      description:
        "Addition of a 7kW EV charge point to the driveway elevation, with the consumer unit uprated to accommodate the additional circuit.",
      cost_delta: 2_950,
      schedule_delta_days: 0,
      status: "proposed",
      requested_by: BUYER_ID,
      decided_by: null,
      decided_at: null,
      created_at: `${addDays(today, -8)}T10:00:00.000Z`,
      updated_at: `${addDays(today, -8)}T10:00:00.000Z`,
    },
  ];

  // ---- Inspections and issues ----------------------------------------------
  const inspections: Inspection[] = [
    {
      name: "Foundation & reinforcement",
      authority: "City Building Control",
      daysAgo: 236,
      result: "pass" as const,
      milestone: "Footings & reinforcement",
    },
    {
      name: "Slab pre-pour",
      authority: "City Building Control",
      daysAgo: 172,
      result: "pass" as const,
      milestone: "Slab pour & cure",
    },
    {
      name: "Structural frame",
      authority: "City Building Control",
      daysAgo: 64,
      result: "pass" as const,
      milestone: "First floor framing",
    },
    {
      name: "Roof covering",
      authority: "City Building Control",
      daysAgo: 24,
      result: "pass" as const,
      milestone: "Roof covering",
    },
    {
      name: "MEP first fix",
      authority: "City Building Control",
      daysAgo: -22,
      result: "pending" as const,
      milestone: "MEP inspection",
    },
    {
      name: "Airtightness (formal)",
      authority: "Accredited tester",
      daysAgo: -38,
      result: "pending" as const,
      milestone: "Insulation & airtightness",
    },
    {
      name: "Final building control",
      authority: "City Building Control",
      daysAgo: -172,
      result: "pending" as const,
      milestone: "Final inspection & handover",
    },
  ].map((spec, i) => ({
    id: id("inspection", i),
    project_id: PROJECT_ID,
    milestone_id: byName.get(spec.milestone) ?? null,
    name: spec.name,
    authority: spec.authority,
    inspector_name: spec.result === "pending" ? null : "Deirdre Halloran",
    scheduled_for: addDays(today, -spec.daysAgo),
    completed_at:
      spec.result === "pending" ? null : `${addDays(today, -spec.daysAgo)}T15:00:00.000Z`,
    result: spec.result,
    notes: spec.result === "pass" ? "Passed without conditions." : null,
    certificate_document_id: null,
    created_at: `${START_DATE}T09:00:00.000Z`,
    updated_at: `${today}T09:00:00.000Z`,
  }));

  const issues: Issue[] = [
    {
      title: "Rear dormer window units short-delivered",
      description:
        "Two rear dormer units arrived with a manufacturing fault on the frames and were rejected on delivery. Supplier is remaking; revised delivery confirmed for 14 days from rejection. Openings are sheeted and weather-protected in the meantime.",
      location: "Rear elevation, first floor",
      severity: "high" as const,
      status: "in_progress" as const,
      daysAgo: 6,
      due: 8,
      milestone: "Windows & external doors",
    },
    {
      title: "Consumer unit position clashes with MVHR unit",
      description:
        "As-drawn consumer unit position leaves insufficient clearance to the ventilation unit. Resolved on site by moving the unit 400mm along the utility wall; architect approved and drawings to be updated at next revision.",
      location: "Utility room",
      severity: "medium" as const,
      status: "resolved" as const,
      daysAgo: 9,
      due: -2,
      milestone: "Electrical first fix",
    },
    {
      title: "Standing water at the north-east corner",
      description:
        "Water is pooling against the north-east corner of the slab after heavy rain rather than draining to the temporary soakaway. Needs regrading before the external works package starts, or it will undermine the patio build-up.",
      location: "North-east external",
      severity: "medium" as const,
      status: "open" as const,
      daysAgo: 12,
      due: 21,
      milestone: "External works & landscaping",
    },
    {
      title: "Scratched glazing unit, ground floor rear",
      description:
        "One ground floor rear pane has a 60mm surface scratch, most likely from the scaffold adaptation. Supplier has been notified and will replace the pane under the installation warranty.",
      location: "Ground floor, rear",
      severity: "low" as const,
      status: "acknowledged" as const,
      daysAgo: 4,
      due: 30,
      milestone: "Windows & external doors",
    },
  ].map((spec, i) => ({
    id: id("issue", i),
    project_id: PROJECT_ID,
    milestone_id: byName.get(spec.milestone) ?? null,
    title: spec.title,
    description: spec.description,
    location: spec.location,
    severity: spec.severity,
    status: spec.status,
    reported_by: i === 2 ? BUYER_ID : BUILDER_ID,
    assigned_to: BUILDER_ID,
    due_date: addDays(today, spec.due),
    resolved_at: spec.status === "resolved" ? `${addDays(today, -3)}T12:00:00.000Z` : null,
    room: ["Rear exterior", "Utility", "Garden", "Dining area"][i] ?? null,
    photo_paths: i === 2 ? [`${PROJECT_ID}/snags/${BUYER_ID}/standing-water.jpg`] : [],
    raised_by_buyer: i === 2,
    created_at: `${addDays(today, -spec.daysAgo)}T09:00:00.000Z`,
    updated_at: `${addDays(today, -spec.daysAgo)}T09:00:00.000Z`,
  }));

  // ---- Progress snapshots (the S-curve) ------------------------------------
  //
  // The planned line is DERIVED from the milestone plan rather than invented:
  // for each date it is the weight-weighted sum of where every milestone should
  // be if it tracked its own window linearly. That guarantees the curve and the
  // Gantt chart tell the same story -- an independently-generated curve drifts
  // away from the schedule and the dashboard starts contradicting itself.
  //
  // The actual line is the planned line minus a deficit that opens up during
  // the wet spell and never fully closes, landing today on exactly the weighted
  // progress the milestones report.
  const snapshots: ProgressSnapshot[] = [];
  const elapsed = ELAPSED_DAYS;

  const weightTotal = milestones.reduce((total, m) => total + m.weight, 0);

  /** Where the plan says the build should be, `day` days after start. */
  const plannedAt = (day: number): number => {
    const total = PHASE_SPECS.flatMap((phase) => phase.milestones).reduce((sum, spec, index) => {
      const weight = milestones[index]?.weight ?? spec.weight;
      const span = spec.duration + 1;
      const elapsedDays = day - spec.offset + 1;
      const share = elapsedDays <= 0 ? 0 : elapsedDays >= span ? 1 : elapsedDays / span;
      return sum + weight * share;
    }, 0);
    return (total / weightTotal) * 100;
  };

  const actualToday =
    milestones.reduce((total, m) => total + m.progress_percent * m.weight, 0) / weightTotal;
  const deficitToday = Math.max(0, plannedAt(elapsed) - actualToday);

  // The deficit opens from the wet spell onward, steeply at first.
  const DEFICIT_ONSET = 130;
  const deficitAt = (day: number): number => {
    if (day <= DEFICIT_ONSET) return 0;
    const progressThrough = (day - DEFICIT_ONSET) / Math.max(1, elapsed - DEFICIT_ONSET);
    return deficitToday * Math.min(1, progressThrough) ** 0.7;
  };

  for (let day = 0; day <= elapsed; day += 7) {
    const planned = plannedAt(day);
    // No noise on the final reading: it must equal the milestones exactly, or
    // the dashboard's headline number and its chart disagree.
    const noise = day === elapsed ? 0 : (random() - 0.5) * 0.8;
    const actual = Math.max(0, Math.min(100, planned - deficitAt(day) + noise));

    snapshots.push({
      id: id("snapshot", day),
      project_id: PROJECT_ID,
      captured_on: addDays(START_DATE, day),
      planned_percent: Number(planned.toFixed(2)),
      actual_percent: Number(actual.toFixed(2)),
      note: null,
      created_at: `${addDays(START_DATE, day)}T18:00:00.000Z`,
    });
  }

  // Ensure the last reading is exactly today, whatever the step landed on.
  if (elapsed % 7 !== 0) {
    snapshots.push({
      id: id("snapshot", elapsed),
      project_id: PROJECT_ID,
      captured_on: today,
      planned_percent: Number(plannedAt(elapsed).toFixed(2)),
      actual_percent: Number(actualToday.toFixed(2)),
      note: null,
      created_at: `${today}T18:00:00.000Z`,
    });
  }

  // ---- Weather -------------------------------------------------------------
  const CONDITIONS = ["Clear", "Partly cloudy", "Overcast", "Light rain", "Heavy rain", "Storm"];
  const weather: WeatherLogEntry[] = [];
  for (let day = Math.max(0, elapsed - 120); day <= elapsed; day += 1) {
    const roll = random();
    // The wet fortnight is scripted, not random, so the story stays put.
    const inWetSpell = day > 130 && day < 148;
    const conditionIdx = inWetSpell
      ? roll < 0.55
        ? 4
        : roll < 0.8
          ? 3
          : 2
      : roll < 0.45
        ? 0
        : roll < 0.7
          ? 1
          : roll < 0.85
            ? 2
            : roll < 0.95
              ? 3
              : 4;

    const condition = CONDITIONS[conditionIdx]!;
    const impact = conditionIdx >= 4 ? "full" : conditionIdx === 3 ? "partial" : ("none" as const);

    weather.push({
      id: id("weather", day),
      project_id: PROJECT_ID,
      observed_on: addDays(START_DATE, day),
      condition,
      temp_c: Number((14 + random() * 18).toFixed(1)),
      precipitation_mm: Number((conditionIdx >= 3 ? random() * 24 : random() * 1.2).toFixed(1)),
      wind_kph: Number((6 + random() * 30).toFixed(1)),
      work_impact: impact as WeatherLogEntry["work_impact"],
      hours_lost: impact === "full" ? 8 : impact === "partial" ? 3 : 0,
      created_at: `${addDays(START_DATE, day)}T18:00:00.000Z`,
    });
  }

  // ---- Notifications and activity -----------------------------------------
  const notifications: AppNotification[] = [
    {
      type: "update_posted" as const,
      title: "Heat pump slab poured, MVHR ducting set out",
      body: "Marcus Adeyemi posted a construction update.",
      hoursAgo: 6,
      read: false,
      link: "/projects/kestrel-house/updates",
    },
    {
      type: "issue_raised" as const,
      title: "Rear dormer window units short-delivered",
      body: "A high severity issue was raised on your project.",
      hoursAgo: 30,
      read: false,
      link: "/projects/kestrel-house/quality",
    },
    {
      type: "payment_due" as const,
      title: "Payment due: Weather-tight",
      body: "$102,750 is due in 8 days.",
      hoursAgo: 52,
      read: false,
      link: "/projects/kestrel-house/finance",
    },
    {
      type: "document_ack_required" as const,
      title: "Change order CO-002 — kitchen upgrade",
      body: "This document needs your acknowledgement.",
      hoursAgo: 96,
      read: true,
      link: "/projects/kestrel-house/documents",
    },
    {
      type: "milestone_completed" as const,
      title: "Roof covering is complete",
      body: "This milestone finished ahead of the revised programme.",
      hoursAgo: 168,
      read: true,
      link: "/projects/kestrel-house/timeline",
    },
    {
      type: "change_order" as const,
      title: "CO-003 submitted for your review",
      body: "EV charger and consumer unit upgrade — $2,950.",
      hoursAgo: 192,
      read: true,
      link: "/projects/kestrel-house/finance",
    },
  ].map((spec, i) => ({
    id: id("notification", i),
    user_id: BUYER_ID,
    project_id: PROJECT_ID,
    type: spec.type,
    title: spec.title,
    body: spec.body,
    link: spec.link,
    read_at: spec.read
      ? new Date(referenceDate.getTime() - spec.hoursAgo * 3_600_000 + 7_200_000).toISOString()
      : null,
    created_at: new Date(referenceDate.getTime() - spec.hoursAgo * 3_600_000).toISOString(),
  }));

  const activity: ActivityLogEntry[] = updates.slice(0, 10).map((update, i) => ({
    id: id("activity", i),
    project_id: PROJECT_ID,
    actor_id: update.author_id,
    action: "posted_update",
    entity_type: "update",
    entity_id: update.id,
    meta: { title: update.title },
    created_at: update.published_at,
  }));

  const buyer = buildBuyerData({
    projectId: PROJECT_ID,
    buyerId: BUYER_ID,
    builderId: BUILDER_ID,
    milestones,
    updates,
    referenceDate,
    timeZone: project.timezone,
  });

  return {
    organization,
    project,
    profiles,
    members: members.map((m) =>
      m.user_id === BUYER_ID ? { ...m, last_seen_at: buyer.buyerLastSeenAt } : m,
    ),
    phases,
    milestones,
    dependencies,
    updates,
    media,
    documents,
    budgetCategories,
    costEntries,
    payments,
    drawRequests,
    changeOrders,
    inspections,
    issues,
    snapshots,
    weather,
    notifications,
    activity,
    selectionCategories: buyer.selectionCategories,
    selectionOptions: buyer.selectionOptions,
    discussions: buyer.discussions,
    discussionMessages: buyer.discussionMessages,
    siteVisits: buyer.siteVisits,
    moveTasks: buyer.moveTasks,
  };
}

export const DEMO_IDS = {
  organization: ORG_ID,
  project: PROJECT_ID,
  buyer: BUYER_ID,
  builder: BUILDER_ID,
  architect: ARCHITECT_ID,
  inspector: INSPECTOR_ID,
} as const;
