import { z } from "zod";

const IdeaStatus = z.enum(["seed", "exploring", "parked", "dead", "shipped"]);

const IdeaSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  status: IdeaStatus,
  tags: z.array(z.string()),
  project: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const LinkSchema = z.object({
  from: z.string(),
  to: z.string(),
  kind: z.enum(["spawned-from", "similar-to", "contradicts", "builds-on"]),
  note: z.string().optional(),
  createdAt: z.string(),
});

const ResearchSchema = z.object({
  ideaId: z.string(),
  query: z.string(),
  sources: z.array(z.string()),
  summary: z.string(),
  date: z.string(),
});

const PriorArtSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
  overlap: z.string(),
  difference: z.string(),
  ideaIds: z.array(z.string()),
  date: z.string(),
});

type Writer = (
  specName: string,
  name: string,
  data: Record<string, unknown>,
) => Promise<{ name: string }>;

interface Ctx {
  writeResource: Writer;
}

/** Lowercase, hyphenated slug usable as a data instance name. */
export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(
    /^-+|-+$/g,
    "",
  ).slice(0, 60);
}

// Idea, link and prior-art records are the long-term memory: keep forever.
const keep = { lifetime: "infinite" as const, garbageCollection: 1000 };

/** Extension behavior type for brainstorming memory. */
export const behavior = {
  type: "@meris/brainstorm",
  version: "2026.10.26.1",
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
  },
  methods: {
    captureIdea: {
      description:
        "Create or update an idea. Same title updates the same record (new version).",
      arguments: z.object({
        title: z.string().min(1),
        summary: z.string().default(""),
        status: IdeaStatus.default("seed"),
        tags: z.array(z.string()).default([]),
        project: z.string().optional(),
      }),
      execute: async (
        args: {
          title: string;
          summary: string;
          status: z.infer<typeof IdeaStatus>;
          tags: string[];
          project?: string;
        },
        context: Ctx,
      ) => {
        const id = slugify(args.title);
        const now = new Date().toISOString();
        const handle = await context.writeResource("idea", id, {
          id,
          title: args.title,
          summary: args.summary,
          status: args.status,
          tags: args.tags,
          project: args.project,
          createdAt: now,
          updatedAt: now,
        });
        return { dataHandles: [handle] };
      },
    },
    linkIdeas: {
      description: "Record a typed link between two ideas (by idea id).",
      arguments: z.object({
        from: z.string().min(1),
        to: z.string().min(1),
        kind: LinkSchema.shape.kind,
        note: z.string().optional(),
      }),
      execute: async (
        args: {
          from: string;
          to: string;
          kind: z.infer<typeof LinkSchema>["kind"];
          note?: string;
        },
        context: Ctx,
      ) => {
        const handle = await context.writeResource(
          "link",
          `${args.from}--${args.kind}--${args.to}`,
          { ...args, createdAt: new Date().toISOString() },
        );
        return { dataHandles: [handle] };
      },
    },
    recordResearch: {
      description: "Store a research summary and its sources for an idea.",
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
        const handle = await context.writeResource(
          "research",
          args.ideaId,
          { ...args, date: new Date().toISOString() },
        );
        return { dataHandles: [handle] };
      },
    },
    recordPriorArt: {
      description: "Store a prior-art entry that one or more ideas relate to.",
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
        const handle = await context.writeResource(
          "priorArt",
          slugify(args.name),
          { ...args, date: new Date().toISOString() },
        );
        return { dataHandles: [handle] };
      },
    },
  },
};
