import { assertEquals } from "@std/assert";
import { createModelTestContext } from "@swamp-club/swamp-testing";
import { behavior, slugify } from "./brainstorm.ts";

Deno.test("slugify makes a stable instance name", () => {
  assertEquals(slugify("  Offline Sync!! "), "offline-sync");
});

Deno.test("captureIdea writes an idea keyed by slug", async () => {
  const { context, getWrittenResources } = createModelTestContext();
  await behavior.methods.captureIdea.execute(
    { title: "Offline Sync", summary: "", status: "seed", tags: ["sync"] },
    context,
  );
  const [written] = getWrittenResources();
  assertEquals(written.specName, "idea");
  assertEquals(written.name, "offline-sync");
  assertEquals(written.data.status, "seed");
});

Deno.test("linkIdeas names the instance from both ends and the kind", async () => {
  const { context, getWrittenResources } = createModelTestContext();
  await behavior.methods.linkIdeas.execute(
    { from: "a", to: "b", kind: "builds-on" },
    context,
  );
  assertEquals(getWrittenResources()[0].name, "a--builds-on--b");
});
