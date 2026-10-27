import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { createReportTestContext } from "@swamp-club/swamp-testing";
import {
  buildIndex,
  report,
  type Snapshot,
} from "./brainstorm_index_report.ts";

const D = "2026-10-27T00:00:00.000Z";

const idea = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: id.toUpperCase(),
  summary: `${id} summary`,
  status: "seed",
  tags: [],
  createdAt: D,
  updatedAt: D,
  ...over,
});

const emptySnap = (over: Partial<Snapshot> = {}): Snapshot => ({
  ideas: [],
  links: [],
  research: [],
  priorArt: [],
  critiques: [],
  unreadable: [],
  ...over,
});

Deno.test("an empty store still renders", () => {
  const { markdown, json } = buildIndex(emptySnap(), D);
  assertStringIncludes(markdown, "0 idea(s), 0 draft(s)");
  assertEquals(json.counts, {
    ideas: 0,
    drafts: 0,
    links: 0,
    critiques: 0,
    unconfirmed: 0,
  });
});

Deno.test("drafts are listed apart from ideas and counted separately", () => {
  const { markdown, json } = buildIndex(
    emptySnap({
      ideas: [idea("a"), idea("b", { status: "draft" })] as never,
    }),
    D,
  );
  assertStringIncludes(markdown, "## Drafts");
  assertStringIncludes(markdown, "1 idea(s), 1 draft(s)");
  const byStatus = markdown.split("## Ideas by status")[1].split(
    "## Idea details",
  )[0];
  assert(!byStatus.includes("`b`"));
  assertEquals((json.counts as { drafts: number }).drafts, 1);
});

Deno.test("unconfirmed ideas are flagged as the agent's guess", () => {
  const confirmed = idea("c", {
    alignment: { state: "confirmed", date: D, note: "" },
  });
  const { markdown, json } = buildIndex(
    emptySnap({ ideas: [idea("a"), confirmed] as never }),
    D,
  );
  assertStringIncludes(markdown, "agent's guess");
  assertStringIncludes(
    markdown,
    "1 idea(s) whose alignment is not confirmed: A",
  );
  assertEquals((json.counts as { unconfirmed: number }).unconfirmed, 1);
});

Deno.test("seeds with no research are called out", () => {
  const { markdown } = buildIndex(
    emptySnap({
      ideas: [idea("a"), idea("b")] as never,
      research: [{
        ideaId: "a",
        query: "q",
        sources: [],
        summary: "found it",
        date: D,
      }],
    }),
    D,
  );
  assertStringIncludes(markdown, "1 seed(s) with no research: B");
});

Deno.test("part-of links show parts under the umbrella and in the graph", () => {
  const { markdown } = buildIndex(
    emptySnap({
      ideas: [idea("whole"), idea("piece")] as never,
      links: [{ from: "piece", to: "whole", kind: "part-of", createdAt: D }],
    }),
    D,
  );
  assertStringIncludes(markdown, "```mermaid");
  assertStringIncludes(markdown, "piece -->|part-of| whole");
  assertStringIncludes(markdown, "**Parts**\n\n- PIECE");
  assertStringIncludes(markdown, "**Part of:** WHOLE");
});

Deno.test("links to missing ideas are left out of the graph", () => {
  const { markdown } = buildIndex(
    emptySnap({
      ideas: [idea("a")] as never,
      links: [{ from: "a", to: "ghost", kind: "builds-on", createdAt: D }],
    }),
    D,
  );
  assert(!markdown.includes("```mermaid"));
});

Deno.test("critique findings show their response or that one is awaited", () => {
  const { markdown } = buildIndex(
    emptySnap({
      ideas: [idea("a")] as never,
      critiques: [{
        key: "critique--a--1",
        ideaId: "a",
        date: D,
        lenses: ["premortem"],
        steelman: "s",
        findings: [
          {
            claim: "too big",
            severity: "fatal",
            basis: "research",
            confidence: "high",
            response: { state: "rejected", reason: "out of scope", date: D },
          },
          {
            claim: "unclear",
            severity: "minor",
            basis: "reasoning only",
            confidence: "low",
          },
        ],
        strengths: [],
        wouldChangeMind: "w",
      }],
    }),
    D,
  );
  assertStringIncludes(markdown, "[fatal] too big");
  assertStringIncludes(markdown, "→ rejected: out of scope");
  assertStringIncludes(markdown, "→ awaiting a response");
});

Deno.test("unreadable records are reported", () => {
  const { markdown, json } = buildIndex(
    emptySnap({ unreadable: ["broken"] }),
    D,
  );
  assertStringIncludes(markdown, "Unreadable records: broken");
  assertEquals(json.unreadable, ["broken"]);
});

Deno.test("the report reads stored records through the data repository", async () => {
  const enc = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value));
  const artifact = (name: string, value: unknown, specName?: string) => {
    const content = enc(value);
    return {
      modelType: "@meris/brainstorm",
      modelId: "brainstorm",
      data: {
        name,
        kind: "resource" as const,
        dataId: name,
        version: 1,
        size: content.length,
        contentType: "application/json",
        ...(specName ? { tags: { type: "resource", specName } } : {}),
      },
      content,
    };
  };
  const { context } = createReportTestContext({
    scope: "model",
    modelType: "@meris/brainstorm",
    modelId: "brainstorm",
    dataArtifacts: [
      artifact("offline-sync", idea("offline-sync", { title: "Offline Sync" })),
      artifact("research--offline-sync", {
        ideaId: "offline-sync",
        query: "q",
        sources: [],
        summary: "s",
        date: D,
      }),
      artifact("report-something", { ignored: true }),
      artifact("bad", { id: 5 }),
    ],
  });
  const result = await report.execute(context as never);
  assertStringIncludes(result.markdown, "Offline Sync");
  assertStringIncludes(result.markdown, "**Research**");
  assertEquals(result.json.unreadable, ["bad"]);
});
