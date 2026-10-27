// Inline, pinned specifier on purpose: swamp's report bundler does not read
// deno.json, so a bare "zod" breaks the index report's rebuild (it then falls
// back to a stale cached bundle without failing).
// deno-lint-ignore no-import-prefix
import { z } from "npm:zod@4.3.6";

const IdeaStatus = z.enum([
  "draft",
  "seed",
  "exploring",
  "parked",
  "dead",
  "shipped",
]);

const LinkKind = z.enum([
  "spawned-from",
  "part-of",
  "similar-to",
  "contradicts",
  "builds-on",
]);

const AlignmentState = z.enum(["unchecked", "confirmed", "disputed"]);

const OptionSchema = z.object({
  name: z.string().min(1),
  tradeoff: z.string(),
  outcome: z.enum(["chosen", "rejected", "open"]),
});

/** A stored idea. Every field after `tags` is optional so older records stay valid. */
export const IdeaSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  status: IdeaStatus,
  tags: z.array(z.string()),
  project: z.string().optional(),
  statement: z.string().optional(),
  goal: z.string().optional(),
  elements: z.record(z.string(), z.string()).optional(),
  rawNotes: z.array(z.object({ date: z.string(), text: z.string() }))
    .optional(),
  alignment: z.object({
    state: AlignmentState,
    date: z.string(),
    note: z.string(),
  }).optional(),
  openQuestions: z.array(z.string()).optional(),
  options: z.array(OptionSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** A typed link between two ideas. */
export const LinkSchema = z.object({
  from: z.string(),
  to: z.string(),
  kind: LinkKind,
  note: z.string().optional(),
  createdAt: z.string(),
});

/** Research notes for one idea. */
export const ResearchSchema = z.object({
  ideaId: z.string(),
  query: z.string(),
  sources: z.array(z.string()),
  summary: z.string(),
  date: z.string(),
});

/** A prior-art entry shared across ideas. */
export const PriorArtSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
  overlap: z.string(),
  difference: z.string(),
  ideaIds: z.array(z.string()),
  date: z.string(),
});

const Severity = z.enum(["fatal", "serious", "minor"]);

const FindingResponse = z.object({
  state: z.enum(["accepted", "rejected", "deferred"]),
  reason: z.string(),
  date: z.string(),
});

const FindingInput = z.object({
  claim: z.string().min(1),
  severity: Severity,
  basis: z.string().min(1),
  confidence: z.enum(["low", "medium", "high"]),
});

/** An adversarial review of one idea, with the person's response to each finding. */
export const CritiqueSchema = z.object({
  ideaId: z.string(),
  date: z.string(),
  lenses: z.array(z.string()),
  steelman: z.string(),
  findings: z.array(
    FindingInput.extend({ response: FindingResponse.optional() }),
  )
    .max(7),
  strengths: z.array(z.string()),
  riskiestAssumption: z.object({
    assumption: z.string(),
    cheapestTest: z.string(),
  }).optional(),
  wouldChangeMind: z.string(),
});

type Idea = z.infer<typeof IdeaSchema>;
type Critique = z.infer<typeof CritiqueSchema>;

type Writer = (
  specName: string,
  name: string,
  data: Record<string, unknown>,
) => Promise<{ name: string }>;

type Reader = (
  name: string,
  version?: number,
) => Promise<Record<string, unknown> | null>;

interface Ctx {
  writeResource: Writer;
  readResource: Reader;
}

/** Lowercase, hyphenated slug usable as a data instance name. */
export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(
    /^-+|-+$/g,
    "",
  ).slice(0, 60);
}

// Ideas are stored under their bare slug. Every other kind carries a prefix or
// a `--` separator, which a slug never contains, so names cannot collide.
const researchName = (ideaId: string) => `research--${ideaId}`;
const priorArtName = (slug: string) => `prior-art--${slug}`;
const critiqueName = (ideaId: string, now: string) =>
  `critique--${ideaId}--${now.replace(/\D/g, "")}`;

function slugOrThrow(text: string, what: string): string {
  const slug = slugify(text);
  if (!slug) throw new Error(`${what} must contain a letter or a number`);
  return slug;
}

async function requireIdeas(ctx: Ctx, ids: string[]): Promise<void> {
  for (const id of ids) {
    if (!await ctx.readResource(id)) throw new Error(`Idea not found: ${id}`);
  }
}

function dropUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}

// Fields shared by captureIdea and updateIdea. All optional so that a call
// changes only what it names.
const IdeaFields = {
  summary: z.string().optional(),
  status: IdeaStatus.optional(),
  tags: z.array(z.string()).optional(),
  project: z.string().optional(),
  statement: z.string().optional(),
  goal: z.string().optional(),
  elements: z.record(z.string(), z.string()).optional(),
  rawNotes: z.array(z.string()).optional(),
  alignment: z.object({
    state: AlignmentState,
    note: z.string().default(""),
  }).optional(),
  openQuestions: z.array(z.string()).optional(),
  options: z.array(OptionSchema).optional(),
};

const CaptureArgs = z.object({ title: z.string().min(1), ...IdeaFields });
const UpdateArgs = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  ...IdeaFields,
});

type IdeaPatch = Omit<z.infer<typeof UpdateArgs>, "id"> & { title?: string };

function mergeElements(
  base: Record<string, string> | undefined,
  patch: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!patch) return base;
  const merged = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === "") delete merged[key];
    else merged[key] = value;
  }
  return merged;
}

/**
 * Apply a patch to an idea. Only the fields the patch names change: arrays
 * (tags, openQuestions, options) are replaced, `elements` is merged by key
 * (an empty value removes a key), and `rawNotes` is appended to. A new idea
 * starts as a `seed` with alignment `unchecked`.
 */
export function applyIdeaPatch(
  existing: Idea | null,
  id: string,
  patch: IdeaPatch,
  now: string,
): Idea {
  const base: Idea = existing ?? {
    id,
    title: patch.title ?? id,
    summary: "",
    status: "seed",
    tags: [],
    alignment: { state: "unchecked", date: now, note: "" },
    createdAt: now,
    updatedAt: now,
  };
  const rawNotes = patch.rawNotes?.length
    ? [
      ...(base.rawNotes ?? []),
      ...patch.rawNotes.map((text) => ({ date: now, text })),
    ]
    : base.rawNotes;
  return dropUndefined({
    ...base,
    title: patch.title ?? base.title,
    summary: patch.summary ?? base.summary,
    status: patch.status ?? base.status,
    tags: patch.tags ?? base.tags,
    // An empty project means "not provided" (the idea factory passes "" when a
    // draft has none), so it never wipes an existing project.
    project: patch.project?.trim() ? patch.project : base.project,
    statement: patch.statement ?? base.statement,
    goal: patch.goal ?? base.goal,
    elements: mergeElements(base.elements, patch.elements),
    rawNotes,
    alignment: patch.alignment
      ? { ...patch.alignment, date: now }
      : base.alignment,
    openQuestions: patch.openQuestions ?? base.openQuestions,
    options: patch.options ?? base.options,
    createdAt: base.createdAt,
    updatedAt: now,
  });
}

// Idea, link, prior-art and critique records are the long-term memory: keep forever.
const keep = { lifetime: "infinite" as const, garbageCollection: 1000 };

const SEVERITY_ORDER = { fatal: 0, serious: 1, minor: 2 } as const;

/** Extension behavior type for brainstorming memory. */
export const behavior = {
  type: "@meris/brainstorm",
  version: "2026.10.27.1",
  globalArguments: z.object({}),
  resources: {
    idea: { description: "A brainstormed idea", schema: IdeaSchema, ...keep },
    link: {
      description: "A typed link between two ideas",
      schema: LinkSchema,
      ...keep,
    },
    research: {
      description: "Research notes for an idea",
      schema: ResearchSchema,
      lifetime: "infinite" as const,
      garbageCollection: 20,
    },
    priorArt: {
      description: "Prior art shared across ideas",
      schema: PriorArtSchema,
      ...keep,
    },
    critique: {
      description: "An adversarial review of an idea",
      schema: CritiqueSchema,
      ...keep,
    },
  },
  methods: {
    captureIdea: {
      description:
        "Create an idea, or update it if the title already exists. Only the fields passed change; createdAt is kept.",
      arguments: CaptureArgs,
      execute: async (args: z.infer<typeof CaptureArgs>, context: Ctx) => {
        const id = slugOrThrow(args.title, "Title");
        const existing = await context.readResource(id) as Idea | null;
        const idea = applyIdeaPatch(
          existing,
          id,
          args,
          new Date().toISOString(),
        );
        return { dataHandles: [await context.writeResource("idea", id, idea)] };
      },
    },
    updateIdea: {
      description:
        "Change fields of an existing idea by id. Arrays are replaced, elements merge by key (empty value removes), rawNotes are appended.",
      arguments: UpdateArgs,
      execute: async (args: z.infer<typeof UpdateArgs>, context: Ctx) => {
        const { id, ...patch } = args;
        const existing = await context.readResource(id) as Idea | null;
        if (!existing) throw new Error(`Idea not found: ${id}`);
        const idea = applyIdeaPatch(
          existing,
          id,
          patch,
          new Date().toISOString(),
        );
        return { dataHandles: [await context.writeResource("idea", id, idea)] };
      },
    },
    linkIdeas: {
      description:
        "Record a typed link between two existing ideas (by idea id). Use part-of for a component, spawned-from for an offshoot.",
      arguments: z.object({
        from: z.string().min(1),
        to: z.string().min(1),
        kind: LinkKind,
        note: z.string().optional(),
      }),
      execute: async (
        args: {
          from: string;
          to: string;
          kind: z.infer<typeof LinkKind>;
          note?: string;
        },
        context: Ctx,
      ) => {
        if (args.from === args.to) {
          throw new Error("Cannot link an idea to itself");
        }
        await requireIdeas(context, [args.from, args.to]);
        const handle = await context.writeResource(
          "link",
          `${args.from}--${args.kind}--${args.to}`,
          dropUndefined({ ...args, createdAt: new Date().toISOString() }),
        );
        return { dataHandles: [handle] };
      },
    },
    recordResearch: {
      description:
        "Store a research summary and its sources for an existing idea.",
      arguments: z.object({
        ideaId: z.string().min(1),
        query: z.string().min(1),
        sources: z.array(z.string()).default([]),
        summary: z.string(),
      }),
      execute: async (
        args: {
          ideaId: string;
          query: string;
          sources: string[];
          summary: string;
        },
        context: Ctx,
      ) => {
        await requireIdeas(context, [args.ideaId]);
        const handle = await context.writeResource(
          "research",
          researchName(args.ideaId),
          { ...args, date: new Date().toISOString() },
        );
        return { dataHandles: [handle] };
      },
    },
    recordPriorArt: {
      description:
        "Store a prior-art entry that one or more existing ideas relate to.",
      arguments: z.object({
        name: z.string().min(1),
        url: z.string().optional(),
        overlap: z.string(),
        difference: z.string(),
        ideaIds: z.array(z.string()).default([]),
      }),
      execute: async (
        args: {
          name: string;
          url?: string;
          overlap: string;
          difference: string;
          ideaIds: string[];
        },
        context: Ctx,
      ) => {
        const slug = slugOrThrow(args.name, "Name");
        await requireIdeas(context, args.ideaIds);
        const handle = await context.writeResource(
          "priorArt",
          priorArtName(slug),
          dropUndefined({ ...args, date: new Date().toISOString() }),
        );
        return { dataHandles: [handle] };
      },
    },
    recordCritique: {
      description:
        "Store an adversarial review of an existing idea. Findings are sorted most severe first; at most seven.",
      arguments: z.object({
        ideaId: z.string().min(1),
        lenses: z.array(z.string()).min(1),
        steelman: z.string().min(1),
        findings: z.array(FindingInput).max(7),
        strengths: z.array(z.string()).default([]),
        riskiestAssumption: z.object({
          assumption: z.string().min(1),
          cheapestTest: z.string().min(1),
        }).optional(),
        wouldChangeMind: z.string().min(1),
      }),
      execute: async (
        args: {
          ideaId: string;
          lenses: string[];
          steelman: string;
          findings: z.infer<typeof FindingInput>[];
          strengths: string[];
          riskiestAssumption?: { assumption: string; cheapestTest: string };
          wouldChangeMind: string;
        },
        context: Ctx,
      ) => {
        await requireIdeas(context, [args.ideaId]);
        const now = new Date().toISOString();
        const findings = [...args.findings].sort((a, b) =>
          SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
        );
        const handle = await context.writeResource(
          "critique",
          critiqueName(args.ideaId, now),
          dropUndefined({ ...args, findings, date: now }),
        );
        return { dataHandles: [handle] };
      },
    },
    renderIndex: {
      description:
        "Write nothing. Exists so the @meris/brainstorm-index report has a method to run after (swamp has no way to run a report on its own).",
      arguments: z.object({}),
      execute: (_args: Record<string, never>, _context: Ctx) =>
        Promise.resolve({ dataHandles: [] }),
    },
    respondToFinding: {
      description:
        "Record the person's response (accepted, rejected or deferred) to one finding of a stored critique.",
      arguments: z.object({
        critique: z.string().min(1),
        index: z.number().int().min(0),
        state: z.enum(["accepted", "rejected", "deferred"]),
        reason: z.string().min(1),
      }),
      execute: async (
        args: {
          critique: string;
          index: number;
          state: "accepted" | "rejected" | "deferred";
          reason: string;
        },
        context: Ctx,
      ) => {
        const stored = await context.readResource(args.critique) as
          | Critique
          | null;
        if (!stored || !Array.isArray(stored.findings)) {
          throw new Error(`Critique not found: ${args.critique}`);
        }
        if (!stored.findings[args.index]) {
          throw new Error(
            `Critique ${args.critique} has no finding ${args.index}`,
          );
        }
        const findings = stored.findings.map((finding, i) =>
          i === args.index
            ? {
              ...finding,
              response: {
                state: args.state,
                reason: args.reason,
                date: new Date().toISOString(),
              },
            }
            : finding
        );
        const handle = await context.writeResource("critique", args.critique, {
          ...stored,
          findings,
        });
        return { dataHandles: [handle] };
      },
    },
  },
};
