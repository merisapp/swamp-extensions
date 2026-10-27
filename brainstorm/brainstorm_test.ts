import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { createModelTestContext } from "@swamp-club/swamp-testing";
import {
  behavior,
  CritiqueSchema,
  IdeaSchema,
  LinkSchema,
  slugify,
} from "./brainstorm.ts";

const LONG_AGO = "2020-01-01T00:00:00.000Z";

const storedIdea = (over: Record<string, unknown> = {}) => ({
  id: "offline-sync",
  title: "Offline Sync",
  summary: "Queue writes locally",
  status: "exploring",
  tags: ["sync"],
  createdAt: LONG_AGO,
  updatedAt: LONG_AGO,
  ...over,
});

const ideas = (...ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, storedIdea({ id })]));

Deno.test("slugify makes a stable instance name", () => {
  assertEquals(slugify("  Offline Sync!! "), "offline-sync");
});

Deno.test("older records without the new fields still parse", () => {
  IdeaSchema.parse(storedIdea());
});

Deno.test("status accepts draft and links accept part-of", () => {
  IdeaSchema.parse(storedIdea({ status: "draft" }));
  LinkSchema.parse({
    from: "a",
    to: "b",
    kind: "part-of",
    createdAt: LONG_AGO,
  });
});

Deno.test("captureIdea creates an unchecked seed keyed by slug", async () => {
  const { context, getWrittenResources } = createModelTestContext();
  await behavior.methods.captureIdea.execute(
    { title: "Offline Sync", tags: ["sync"] },
    context,
  );
  const [written] = getWrittenResources();
  assertEquals(written.specName, "idea");
  assertEquals(written.name, "offline-sync");
  assertEquals(written.data.status, "seed");
  assertEquals(written.data.summary, "");
  assertEquals(written.data.tags, ["sync"]);
  assertEquals(
    (written.data.alignment as { state: string }).state,
    "unchecked",
  );
  assertEquals(written.data.createdAt, written.data.updatedAt);
  IdeaSchema.parse(written.data);
});

Deno.test("captureIdea rejects a title with no letters or numbers", async () => {
  const { context } = createModelTestContext();
  await assertRejects(
    () => behavior.methods.captureIdea.execute({ title: "!!!" }, context),
    Error,
    "letter or a number",
  );
});

Deno.test("captureIdea on an existing idea keeps createdAt and untouched fields", async () => {
  const { context, getWrittenResources } = createModelTestContext({
    storedResources: { "offline-sync": storedIdea() },
  });
  await behavior.methods.captureIdea.execute(
    { title: "Offline Sync", status: "parked" },
    context,
  );
  const { data } = getWrittenResources()[0];
  assertEquals(data.status, "parked");
  assertEquals(data.summary, "Queue writes locally");
  assertEquals(data.tags, ["sync"]);
  assertEquals(data.createdAt, LONG_AGO);
  assert((data.updatedAt as string) > LONG_AGO);
});

Deno.test("updateIdea sets the edited idea and stamps alignment", async () => {
  const { context, getWrittenResources } = createModelTestContext({
    storedResources: { "offline-sync": storedIdea() },
  });
  await behavior.methods.updateIdea.execute({
    id: "offline-sync",
    statement: "Apps keep working without a network.",
    goal: "Zero data loss offline.",
    alignment: { state: "confirmed", note: "boundary: no merge UI" },
    openQuestions: ["Which conflict policy?"],
    options: [{ name: "CRDT", tradeoff: "Complex", outcome: "open" }],
  }, context);
  const { data } = getWrittenResources()[0];
  assertEquals(data.statement, "Apps keep working without a network.");
  assertEquals(data.goal, "Zero data loss offline.");
  const alignment = data.alignment as { state: string; date: string };
  assertEquals(alignment.state, "confirmed");
  assert(alignment.date > LONG_AGO);
  assertEquals(data.summary, "Queue writes locally");
  assertEquals(data.createdAt, LONG_AGO);
  IdeaSchema.parse(data);
});

Deno.test("updateIdea appends rawNotes and never rewrites earlier ones", async () => {
  const { context, getWrittenResources } = createModelTestContext({
    storedResources: {
      "offline-sync": storedIdea({
        rawNotes: [{ date: LONG_AGO, text: "first words" }],
      }),
    },
  });
  await behavior.methods.updateIdea.execute(
    { id: "offline-sync", rawNotes: ["more words"] },
    context,
  );
  const notes = getWrittenResources()[0].data.rawNotes as {
    date: string;
    text: string;
  }[];
  assertEquals(notes.map((n) => n.text), ["first words", "more words"]);
  assertEquals(notes[0].date, LONG_AGO);
});

Deno.test("updateIdea merges elements by key and removes on empty value", async () => {
  const { context, getWrittenResources } = createModelTestContext({
    storedResources: {
      "offline-sync": storedIdea({
        elements: { problem: "lost writes", audience: "field staff" },
      }),
    },
  });
  await behavior.methods.updateIdea.execute({
    id: "offline-sync",
    elements: { approach: "local queue", audience: "" },
  }, context);
  assertEquals(getWrittenResources()[0].data.elements, {
    problem: "lost writes",
    approach: "local queue",
  });
});

Deno.test("updateIdea commits a draft in place without a second record", async () => {
  const { context, getWrittenResources } = createModelTestContext({
    storedResources: { "offline-sync": storedIdea({ status: "draft" }) },
  });
  await behavior.methods.updateIdea.execute(
    { id: "offline-sync", status: "seed" },
    context,
  );
  const written = getWrittenResources();
  assertEquals(written.length, 1);
  assertEquals(written[0].name, "offline-sync");
  assertEquals(written[0].data.status, "seed");
});

Deno.test("an empty project leaves the existing project alone", async () => {
  const { context, getWrittenResources } = createModelTestContext({
    storedResources: { "offline-sync": storedIdea({ project: "myapp" }) },
  });
  await behavior.methods.updateIdea.execute(
    { id: "offline-sync", project: "" },
    context,
  );
  assertEquals(getWrittenResources()[0].data.project, "myapp");
  await behavior.methods.updateIdea.execute(
    { id: "offline-sync", project: "other" },
    context,
  );
  assertEquals(getWrittenResources()[1].data.project, "other");
});

Deno.test("updateIdea fails for an idea that does not exist", async () => {
  const { context } = createModelTestContext();
  await assertRejects(
    () => behavior.methods.updateIdea.execute({ id: "nope" }, context),
    Error,
    "Idea not found: nope",
  );
});

Deno.test("linkIdeas names the instance from both ends and the kind", async () => {
  const { context, getWrittenResources } = createModelTestContext({
    storedResources: ideas("a", "b"),
  });
  await behavior.methods.linkIdeas.execute(
    { from: "a", to: "b", kind: "part-of" },
    context,
  );
  assertEquals(getWrittenResources()[0].name, "a--part-of--b");
  LinkSchema.parse(getWrittenResources()[0].data);
});

Deno.test("linkIdeas rejects a missing idea and a self link", async () => {
  const { context } = createModelTestContext({ storedResources: ideas("a") });
  await assertRejects(
    () =>
      behavior.methods.linkIdeas.execute(
        { from: "a", to: "ghost", kind: "builds-on" },
        context,
      ),
    Error,
    "Idea not found: ghost",
  );
  await assertRejects(
    () =>
      behavior.methods.linkIdeas.execute(
        { from: "a", to: "a", kind: "similar-to" },
        context,
      ),
    Error,
    "itself",
  );
});

Deno.test("recordResearch uses its own instance name so the idea is not overwritten", async () => {
  const { context, getWrittenResources } = createModelTestContext({
    storedResources: ideas("offline-sync"),
  });
  await behavior.methods.recordResearch.execute(
    { ideaId: "offline-sync", query: "q", sources: [], summary: "s" },
    context,
  );
  const [written] = getWrittenResources();
  assertEquals(written.specName, "research");
  assertEquals(written.name, "research--offline-sync");
});

Deno.test("recordResearch fails for a missing idea", async () => {
  const { context } = createModelTestContext();
  await assertRejects(
    () =>
      behavior.methods.recordResearch.execute(
        { ideaId: "ghost", query: "q", sources: [], summary: "s" },
        context,
      ),
    Error,
    "Idea not found: ghost",
  );
});

Deno.test("recordPriorArt is prefixed and checks the ideas it names", async () => {
  const { context, getWrittenResources } = createModelTestContext({
    storedResources: ideas("offline-sync"),
  });
  await behavior.methods.recordPriorArt.execute({
    name: "Offline Sync",
    overlap: "all",
    difference: "none",
    ideaIds: ["offline-sync"],
  }, context);
  assertEquals(getWrittenResources()[0].name, "prior-art--offline-sync");
  await assertRejects(
    () =>
      behavior.methods.recordPriorArt.execute({
        name: "Other",
        overlap: "x",
        difference: "y",
        ideaIds: ["ghost"],
      }, context),
    Error,
    "Idea not found: ghost",
  );
});

const critiqueArgs = (findings: unknown[]) => ({
  ideaId: "offline-sync",
  lenses: ["premortem"],
  steelman: "Strongest version.",
  findings,
  strengths: ["Clear need"],
  wouldChangeMind: "Evidence of real demand.",
});

Deno.test("recordCritique sorts findings most severe first and stamps the name", async () => {
  const { context, getWrittenResources } = createModelTestContext({
    storedResources: ideas("offline-sync"),
  });
  await behavior.methods.recordCritique.execute(
    critiqueArgs([
      {
        claim: "minor",
        severity: "minor",
        basis: "reasoning only",
        confidence: "low",
      },
      {
        claim: "fatal",
        severity: "fatal",
        basis: "research",
        confidence: "high",
      },
      {
        claim: "serious",
        severity: "serious",
        basis: "reasoning only",
        confidence: "medium",
      },
    ]) as never,
    context,
  );
  const [written] = getWrittenResources();
  assertEquals(written.specName, "critique");
  assert(/^critique--offline-sync--\d+$/.test(written.name));
  assertEquals(
    (written.data.findings as { claim: string }[]).map((f) => f.claim),
    ["fatal", "serious", "minor"],
  );
  CritiqueSchema.parse(written.data);
});

Deno.test("a critique allows at most seven findings", () => {
  const finding = {
    claim: "c",
    severity: "minor",
    basis: "b",
    confidence: "low",
  };
  const base = {
    ideaId: "x",
    date: LONG_AGO,
    lenses: [],
    steelman: "",
    strengths: [],
    wouldChangeMind: "",
  };
  CritiqueSchema.parse({ ...base, findings: Array(7).fill(finding) });
  assertThrows(() =>
    CritiqueSchema.parse({ ...base, findings: Array(8).fill(finding) })
  );
  assertThrows(() =>
    behavior.methods.recordCritique.arguments.parse(
      critiqueArgs(Array(8).fill(finding)),
    )
  );
});

Deno.test("respondToFinding records the response on one finding", async () => {
  const stored = {
    ideaId: "offline-sync",
    date: LONG_AGO,
    lenses: ["premortem"],
    steelman: "s",
    findings: [
      { claim: "a", severity: "fatal", basis: "b", confidence: "high" },
      { claim: "b", severity: "minor", basis: "b", confidence: "low" },
    ],
    strengths: [],
    wouldChangeMind: "w",
  };
  const name = "critique--offline-sync--20200101000000000";
  const { context, getWrittenResources } = createModelTestContext({
    storedResources: { [name]: stored },
  });
  await behavior.methods.respondToFinding.execute(
    { critique: name, index: 1, state: "rejected", reason: "Out of scope" },
    context,
  );
  const [written] = getWrittenResources();
  assertEquals(written.name, name);
  const findings = written.data.findings as { response?: { state: string } }[];
  assertEquals(findings[0].response, undefined);
  assertEquals(findings[1].response?.state, "rejected");
  CritiqueSchema.parse(written.data);
});

Deno.test("respondToFinding fails for a missing critique or finding", async () => {
  const name = "critique--x--1";
  const { context } = createModelTestContext({
    storedResources: {
      [name]: { findings: [{ claim: "a" }] },
    },
  });
  await assertRejects(
    () =>
      behavior.methods.respondToFinding.execute(
        {
          critique: "critique--ghost--1",
          index: 0,
          state: "accepted",
          reason: "r",
        },
        context,
      ),
    Error,
    "Critique not found",
  );
  await assertRejects(
    () =>
      behavior.methods.respondToFinding.execute(
        { critique: name, index: 5, state: "accepted", reason: "r" },
        context,
      ),
    Error,
    "no finding 5",
  );
});
