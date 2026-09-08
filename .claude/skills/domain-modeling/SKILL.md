---
name: domain-modeling
description: Build a shared domain model while interviewing — capture each settled decision as an ADR and each contested word as a glossary entry, as the conversation goes. Use alongside a grilling session, or whenever a design discussion keeps stalling on what a term means or on who owns which data.
---

Model the domain *while* you interview. Do not wait for the end and write it up.

## The two artefacts

Write both under `docs/`:

- `docs/decisions/ADR-NNNN-<slug>.md` — one per decision that is actually settled
- `docs/glossary.md` — one entry per term that carries different meanings for
  different people

Keep `docs/decisions/README.md` as an index with a status column, plus the
list of assumptions every ADR rests on.

## ADR rules

Record the **reasoning**, not just the outcome. Someone reading it two years
later needs to know which assumption held it up, so they can tell whether it
still holds.

Each ADR carries:

- **สถานะ / Status** — `Accepted` only when the person answered. A recommendation
  you made and they have not confirmed is `Proposed`, and says so plainly.
- **Context** — the facts that forced the decision, including the ones that
  arrived late and killed an earlier argument.
- **Decision** — one sentence a person could act on.
- **Consequences** — what you gain, what you now owe, and **the conditions that
  would invalidate this ADR**. The last one matters most.

Never quietly rewrite a decision that new information overturned. Write a new
ADR that limits or supersedes the old one, and link them in both directions.
The trail of how the answer changed is the valuable part.

## Glossary rules

Add a term the moment two people use it for different things. In practice that
is the real cause of a stalled design: the teams are not disagreeing, they are
answering different questions.

Each entry says what the term means **and who owns the data behind it**. A term
with two owners is a defect — surface it rather than smoothing it over.

## Ownership modelling

When the domain spans systems, split ownership by **who actually knows the
data**, never by which system is more important or which team asked first.
Data that only one system observes belongs to that system. Two systems writing
one field is where governance fails — not at the table boundary.

## Working rhythm

1. Ask one question.
2. When it settles, write or amend the ADR before asking the next one.
3. When a word turns out to be doing two jobs, add it to the glossary and
   say so out loud — that is usually the actual blocker.
4. Commit as you go, so the documents survive the conversation.
