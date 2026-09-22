# Plant Data Model

## Record lifecycle

A record has a workflow status and an identification confidence. They answer different questions.

- `draft`: imported, observed or AI-assisted material that has not completed editorial review.
- `review`: an editor is checking content, evidence and safety fields.
- `published`: eligible for public display after editorial approval and validation.

Identification confidence is one of:

- `confirmed`: species identity supported by sufficient diagnostic evidence and authoritative verification.
- `high_confidence`: strong but not definitive species identification.
- `probable`: plausible species-level identification with unresolved alternatives.
- `genus_only`: genus is supported but species is unresolved.
- `unidentified`: no reliable taxon identification.

A record with `genus_only` or `unidentified` must never be published as a species profile.

## Canonical schema

```json
{
  "id": "plant_000001",
  "status": "draft",
  "taxonomy": {
    "bulgarian_name": null,
    "scientific_name": null,
    "family": null,
    "rank": "species"
  },
  "identification": {
    "confidence": "unidentified",
    "visible_diagnostic_features": [],
    "possible_lookalikes": [],
    "uncertainty_note": null
  },
  "ecology": {
    "habitat": [],
    "observation_date": null,
    "observation_location": null
  },
  "content": {
    "benefits": [],
    "risks": {
      "humans": [],
      "dogs": [],
      "cats": [],
      "livestock": []
    },
    "uses": [],
    "interesting_fact": null
  },
  "evidence": {
    "sources": [],
    "photos": []
  },
  "provenance": {
    "ai_analysis": [],
    "editor_review": {
      "reviewed_by": null,
      "reviewed_at": null,
      "decision": "pending",
      "notes": null
    }
  },
  "created_at": "2026-08-17T00:00:00.000Z",
  "updated_at": "2026-08-17T00:00:00.000Z"
}
```

## Field rules

- `id` is immutable, unique and never derived from a file name alone.
- `scientific_name` uses the accepted scientific name where known; uncertainty belongs in `identification`, not in the scientific-name field.
- `sources` must identify the source title or database, URL/identifier where available, access date when relevant, and the claim it supports.
- Each photo reference must include a stable path or object ID, an optional capture date, and an optional relation to the record.
- Benefits, risks and uses are structured claims. A claim involving toxicity, ingestion, medical effect or safety requires appropriate evidence.
- `ai_analysis` preserves model output, model/version if known, input-photo references, timestamp and limitations. It is never copied automatically into published content.

## Publication gate

A record can transition to `published` only when all conditions hold:

1. Confidence is `confirmed`, `high_confidence` or `probable`; publication must disclose uncertainty for `high_confidence` and `probable`.
2. A scientific name, rank, diagnostic features, uncertainty note and at least one image reference are present.
3. Safety fields have been reviewed. Any toxicity, edible, medicinal or safe-for-animal claim has a supporting source.
4. Editor review is marked approved with reviewer and timestamp.
5. Schema and image-path validation pass.

## Separation of concerns

| Layer | May contain | May publish automatically? |
|---|---|---|
| AI analysis | Labels, hypotheses, confidence rationale, limitations | No |
| Editor review | Corrections, verification decision, safety review | No |
| Published record | Validated public profile and source-backed claims | Only after explicit editor approval |
