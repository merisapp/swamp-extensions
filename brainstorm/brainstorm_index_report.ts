import {
  CritiqueSchema,
  IdeaSchema,
  LinkSchema,
  PriorArtSchema,
  ResearchSchema,
} from "./brainstorm.ts";

type Idea = ReturnType<typeof IdeaSchema.parse>;
type Link = ReturnType<typeof LinkSchema.parse>;
type Research = ReturnType<typeof ResearchSchema.parse>;
type PriorArt = ReturnType<typeof PriorArtSchema.parse>;
type Critique = ReturnType<typeof CritiqueSchema.parse>;

/** Everything the index is built from, already parsed. */
export interface Snapshot {
  ideas: Idea[];
  links: Link[];
  research: Research[];
  priorArt: (PriorArt & { key: string })[];
  critiques: (Critique & { key: string })[];
  /** Names of records that did not match their schema. */
  unreadable: string[];
}

const STATUS_ORDER = [
  "exploring",
  "seed",
  "parked",
  "shipped",
  "dead",
] as const;

const escapeCell = (text: string) => text.replace(/\|/g, "\\|");
const day = (iso: string) => iso.slice(0, 10);
const nodeId = (id: string) => id.replace(/[^a-zA-Z0-9]/g, "_");

/** Unconfirmed alignment means the statement is the agent's guess, not the person's idea. */
const isGuess = (idea: Idea) =>
  (idea.alignment?.state ?? "unchecked") !== "confirmed";

function alignmentLabel(idea: Idea): string {
  const state = idea.alignment?.state ?? "unchecked";
  return state === "confirmed"
    ? "confirmed"
    : `${state} (agent's guess, not yet confirmed)`;
}

function ideaLine(idea: Idea): string {
  const text = idea.statement ?? idea.summary;
  const bits = [
    text ? ` — ${text}` : "",
    idea.tags.length ? ` · ${idea.tags.map((t) => `#${t}`).join(" ")}` : "",
    idea.project ? ` · ${idea.project}` : "",
    isGuess(idea) ? " · ⚠ unconfirmed" : "",
  ];
  return `- **${idea.title}** (\`${idea.id}\`)${bits.join("")}`;
}

function detail(idea: Idea, snap: Snapshot): string[] {
  const out = [`### ${idea.title}`, ""];
  out.push(
    `\`${idea.id}\` · ${idea.status} · alignment: ${alignmentLabel(idea)}` +
      ` · updated ${day(idea.updatedAt)}`,
  );
  if (idea.statement) out.push("", `**Statement.** ${idea.statement}`);
  else if (idea.summary) out.push("", idea.summary);
  if (idea.goal) out.push("", `**Goal.** ${idea.goal}`);
  if (idea.alignment?.note) {
    out.push("", `**Alignment note.** ${idea.alignment.note}`);
  }

  const elements = Object.entries(idea.elements ?? {});
  if (elements.length) {
    out.push("", ...elements.map(([k, v]) => `- **${k}:** ${v}`));
  }

  if (idea.options?.length) {
    out.push("", "| Option | Trade-off | Outcome |", "| --- | --- | --- |");
    for (const o of idea.options) {
      out.push(
        `| ${escapeCell(o.name)} | ${escapeCell(o.tradeoff)} | ${o.outcome} |`,
      );
    }
  }
  if (idea.openQuestions?.length) {
    out.push("", "**Open questions**", "");
    out.push(...idea.openQuestions.map((q) => `- ${q}`));
  }

  const titleOf = (id: string) =>
    snap.ideas.find((i) => i.id === id)?.title ?? id;
  const parts = snap.links.filter((l) =>
    l.kind === "part-of" && l.to === idea.id
  );
  const partOf = snap.links.filter((l) =>
    l.kind === "part-of" && l.from === idea.id
  );
  const others = snap.links.filter((l) =>
    l.kind !== "part-of" && (l.from === idea.id || l.to === idea.id)
  );
  if (parts.length) {
    out.push("", "**Parts**", "", ...parts.map((l) => `- ${titleOf(l.from)}`));
  }
  if (partOf.length) {
    out.push("", `**Part of:** ${partOf.map((l) => titleOf(l.to)).join(", ")}`);
  }
  if (others.length) {
    out.push("", "**Links**", "");
    for (const l of others) {
      out.push(
        l.from === idea.id
          ? `- ${l.kind} → ${titleOf(l.to)}${l.note ? ` (${l.note})` : ""}`
          : `- ${titleOf(l.from)} ${l.kind} → this${
            l.note ? ` (${l.note})` : ""
          }`,
      );
    }
  }

  const research = snap.research.find((r) => r.ideaId === idea.id);
  if (research) {
    out.push("", `**Research** (${day(research.date)}): ${research.summary}`);
    if (research.sources.length) {
      out.push("", ...research.sources.map((s) => `- ${s}`));
    }
  }
  for (const pa of snap.priorArt.filter((p) => p.ideaIds.includes(idea.id))) {
    out.push(
      "",
      `**Prior art: ${pa.name}**${pa.url ? ` (${pa.url})` : ""}`,
      "",
      `- Overlap: ${pa.overlap}`,
      `- Difference: ${pa.difference}`,
    );
  }
  for (const c of snap.critiques.filter((c) => c.ideaId === idea.id)) {
    out.push("", `**Review** (${day(c.date)}, ${c.lenses.join(", ")})`, "");
    if (c.findings.length === 0) out.push("- No findings.");
    for (const f of c.findings) {
      const response = f.response
        ? ` → ${f.response.state}: ${f.response.reason}`
        : " → awaiting a response";
      out.push(
        `- [${f.severity}] ${f.claim} (basis: ${f.basis}; ${f.confidence} confidence)${response}`,
      );
    }
    if (c.riskiestAssumption) {
      out.push(
        "",
        `Riskiest assumption: ${c.riskiestAssumption.assumption}. ` +
          `Cheapest test: ${c.riskiestAssumption.cheapestTest}.`,
      );
    }
  }
  if (idea.rawNotes?.length) {
    out.push("", `_${idea.rawNotes.length} raw note(s) kept._`);
  }
  return out;
}

/** Render the index. Drafts are listed apart from ideas, as the spec says. */
export function buildIndex(snap: Snapshot, generated: string) {
  const drafts = snap.ideas.filter((i) => i.status === "draft");
  const ideas = snap.ideas.filter((i) => i.status !== "draft");
  const byTitle = (a: Idea, b: Idea) => a.title.localeCompare(b.title);

  const md: string[] = [
    "# Brainstorm index",
    "",
    `${ideas.length} idea(s), ${drafts.length} draft(s) · generated ${
      day(generated)
    }`,
  ];

  const hasResearch = new Set(snap.research.map((r) => r.ideaId));
  const attention: string[] = [];
  if (drafts.length) {
    attention.push(`- ${drafts.length} parked draft(s) to resume`);
  }
  const guesses = ideas.filter(isGuess);
  if (guesses.length) {
    attention.push(
      `- ${guesses.length} idea(s) whose alignment is not confirmed: ` +
        guesses.map((i) => i.title).join(", "),
    );
  }
  const unresearched = ideas.filter((i) =>
    i.status === "seed" && !hasResearch.has(i.id)
  );
  if (unresearched.length) {
    attention.push(
      `- ${unresearched.length} seed(s) with no research: ` +
        unresearched.map((i) => i.title).join(", "),
    );
  }
  if (snap.unreadable.length) {
    attention.push(`- Unreadable records: ${snap.unreadable.join(", ")}`);
  }
  if (attention.length) md.push("", "## Needs attention", "", ...attention);

  if (drafts.length) {
    md.push("", "## Drafts", "", ...drafts.sort(byTitle).map(ideaLine));
  }

  md.push("", "## Ideas by status");
  for (const status of STATUS_ORDER) {
    const group = ideas.filter((i) => i.status === status).sort(byTitle);
    if (!group.length) continue;
    md.push("", `### ${status} (${group.length})`, "", ...group.map(ideaLine));
  }

  const known = new Set(snap.ideas.map((i) => i.id));
  const links = snap.links.filter((l) => known.has(l.from) && known.has(l.to));
  if (links.length) {
    const titleOf = (id: string) => snap.ideas.find((i) => i.id === id)!.title;
    md.push("", "## Link graph", "", "```mermaid", "flowchart LR");
    const used = new Set(links.flatMap((l) => [l.from, l.to]));
    for (const id of used) {
      md.push(`  ${nodeId(id)}["${titleOf(id).replace(/"/g, "'")}"]`);
    }
    for (const l of links) {
      md.push(`  ${nodeId(l.from)} -->|${l.kind}| ${nodeId(l.to)}`);
    }
    md.push("```");
  }

  if (snap.ideas.length) md.push("", "## Idea details");
  for (const idea of [...ideas.sort(byTitle), ...drafts.sort(byTitle)]) {
    md.push("", ...detail(idea, snap));
  }

  return {
    markdown: md.join("\n") + "\n",
    json: {
      generated,
      counts: {
        ideas: ideas.length,
        drafts: drafts.length,
        links: snap.links.length,
        critiques: snap.critiques.length,
        unconfirmed: guesses.length,
      },
      ideas: snap.ideas.map((i) => ({
        id: i.id,
        title: i.title,
        status: i.status,
        alignment: i.alignment?.state ?? "unchecked",
      })),
      unreadable: snap.unreadable,
    },
  };
}

interface ReportContext {
  modelType: unknown;
  modelId: string;
  dataRepository: {
    findAllForModel(
      type: never,
      modelId: string,
    ): Promise<{ name: string; tags?: Record<string, string> }[]>;
    getContent(
      type: never,
      modelId: string,
      name: string,
    ): Promise<Uint8Array | null>;
  };
}

function specOf(data: { name: string; tags?: Record<string, string> }) {
  if (data.tags?.type === "report" || data.name.startsWith("report-")) {
    return "report";
  }
  if (data.tags?.specName) return data.tags.specName;
  if (data.name.startsWith("research--")) return "research";
  if (data.name.startsWith("prior-art--")) return "priorArt";
  if (data.name.startsWith("critique--")) return "critique";
  return data.name.includes("--") ? "link" : "idea";
}

/** Report extension: a readable index of everything the behavior has stored. */
export const report = {
  name: "@meris/brainstorm-index",
  description:
    "Render stored ideas as an index: needs-attention list, drafts, ideas by status, link graph and per-idea details.",
  scope: "model" as const,
  labels: ["brainstorm"],
  execute: async (context: ReportContext) => {
    const repo = context.dataRepository;
    const type = context.modelType as never;
    const names = new Map<string, string>();
    for (const data of await repo.findAllForModel(type, context.modelId)) {
      names.set(data.name, specOf(data));
    }

    const snap: Snapshot = {
      ideas: [],
      links: [],
      research: [],
      priorArt: [],
      critiques: [],
      unreadable: [],
    };
    const schemas = {
      idea: IdeaSchema,
      link: LinkSchema,
      research: ResearchSchema,
      priorArt: PriorArtSchema,
      critique: CritiqueSchema,
    } as const;
    for (const [name, spec] of names) {
      if (!(spec in schemas)) continue;
      const raw = await repo.getContent(type, context.modelId, name);
      const parsed = raw
        ? schemas[spec as keyof typeof schemas].safeParse(
          JSON.parse(new TextDecoder().decode(raw)),
        )
        : null;
      if (!parsed?.success) {
        snap.unreadable.push(name);
        continue;
      }
      const value = parsed.data as never;
      if (spec === "idea") snap.ideas.push(value);
      else if (spec === "link") snap.links.push(value);
      else if (spec === "research") snap.research.push(value);
      else if (spec === "priorArt") {
        snap.priorArt.push({ ...(value as PriorArt), key: name });
      } else snap.critiques.push({ ...(value as Critique), key: name });
    }
    return buildIndex(snap, new Date().toISOString());
  },
};
