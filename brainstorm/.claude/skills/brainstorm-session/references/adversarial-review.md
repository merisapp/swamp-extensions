# Adversarial review

Run only when the person asks. The review is a separate subagent with a fresh
context, so it does not inherit your rapport with the person or the framing you
built with them. It uses the same model as you.

## How to run it

1. Read the stored idea in full (recall.md: "One idea in full"), plus its
   research, prior art, links and any earlier critiques.
2. Start a subagent (the Agent tool, general-purpose) with the prompt below.
   Give it **only** the stored records, not the conversation. Tell it not to run
   any `swamp` command that writes, and not to edit files.
3. Check its answer against the rules below (at most seven findings, every
   finding has a basis, no fixes). Send it back if it breaks them.
4. Record it, show the findings to the person most severe first, and record each
   of their answers. Where depends on the situation:
   - **During a session** (the factory's `review` stage): the idea is not stored
     yet, so record the findings as the session's `review` artifact and resolve
     each with the person's answer (`resolve_findings`). Convert the reviewer's
     JSON: `fatal` is `critical`, `serious` is `high`, `minor` is `low`; `claim`
     becomes `description` with the basis and confidence appended
     (`"<claim> (basis: research; high confidence)"`); the lens goes in
     `category`; number them `ADV-1`, `ADV-2`... The strengths, riskiest
     assumption and what would change the reviewer's mind go in the `note` you
     show the person; they are not part of the artifact. The shapes are in
     factory-driving.md.
   - **On a stored idea, later**: `recordCritique` with the reviewer's JSON as
     is, and `respondToFinding` for each answer. That keeps the review with the
     idea permanently and shows it in the index.

## Prompt for the reviewer

> You are a skeptical reviewer. Your job is to find what is wrong with the idea
> below, not to improve it and not to be agreeable. You have only the stored
> records; you were not part of the conversation that produced them. Do not
> modify anything.
>
> Work through these lenses and skip any that do not apply:
>
> 1. **Steelman.** State the strongest honest version of the idea, so your
>    critique attacks the idea and not a weak reading of it.
> 2. **Premortem.** Assume it is a year later and the idea failed. List the
>    plausible reasons. List only; do not propose fixes in this step.
> 3. **Assumption map.** List what must be true for the idea to work. Rate each
>    by how much it matters and how much evidence supports it. Name the riskiest
>    assumption (important, no evidence) and the cheapest way to test it.
> 4. **Devil's advocate.** Build the best case for the alternative: do nothing,
>    use what already exists, or take the opposite approach. Do this last.
> 5. **Red team.** Take the view of a competitor, a skeptical user, or someone
>    the idea would hurt, and say how they would react.
> 6. **Prior art.** Using the stored research and prior art, say how much of the
>    idea is left once existing work is removed.
>
> Rules for the answer:
>
> - At most seven findings, most severe first (`fatal`, `serious`, `minor`).
> - Every finding states its basis: the stored record, research, a known
>   example, or `reasoning only`. If it has no basis, say it is speculation. A
>   wrong objection is worse than a missing one.
> - Findings state problems, not fixes.
> - Say what is strong, and what evidence would change your mind. Do not give a
>   go or no-go verdict; the person decides.
>
> Return JSON only, in this shape:

```json
{
  "ideaId": "offline-sync",
  "lenses": ["premortem", "assumption-map"],
  "steelman": "The strongest honest version of the idea.",
  "findings": [
    {
      "claim": "What is wrong.",
      "severity": "fatal",
      "basis": "research",
      "confidence": "high"
    }
  ],
  "strengths": ["What is strong."],
  "riskiestAssumption": {
    "assumption": "Users are offline often.",
    "cheapestTest": "Ask five users."
  },
  "wouldChangeMind": "Evidence of real demand."
}
```

`severity`: `fatal`, `serious`, `minor`. `confidence`: `low`, `medium`, `high`.
`riskiestAssumption` is optional. Save the answer to a JSON file in your
scratchpad and pass it with `--input-file`.

## After the review

A rejected finding is not raised again by a later review unless the idea has
changed. When you run another review, tell the reviewer which findings the
person rejected and why, and that it should not repeat them unless the idea has
changed since.

## Where this comes from

Klein's premortem and the CIA's 2009 _A Tradecraft Primer_ (devil's advocacy,
red team), assumption mapping and riskiest-assumption tests, and research on LLM
review panels (distinct roles help; agents tend to agree too early). The
premortem steps and the primer's definitions come from secondary summaries that
were not checked against the originals. "Steelman first" and the seven-finding
cap are judgment calls.
