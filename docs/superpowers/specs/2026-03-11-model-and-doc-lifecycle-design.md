## Summary

Implement a tracked document registry that separates source upload from tier-specific indexing.

## Decisions

- Default chat model is `openai/gpt-oss-20b`.
- `openai/gpt-oss-20b` uses provider sorting by price.
- Add `openai/gpt-oss-120b` with provider constraints `atlas-cloud/fp8` and `google-vertex`.
- Session uploads persist immediately but are not indexed until the user sends a prompt in that session.
- Once a session document has been uploaded for a session, it remains part of that session corpus for later prompts.
- Global uploads register immediately, process the current tier first, and process remaining tiers sequentially afterward.

## Backend

- Add tracked document metadata with per-tier state.
- Expose tracked document state through `/docs/list`.
- Start current-tier background ingestion for global uploads.
- Let pipeline-triggered indexing handle session uploads and any not-yet-ready tier.

## Frontend

- Render tracked document status instead of assuming upload implies indexing.
- Keep session attachments staged until send.
- Show global documents immediately and poll until processing settles.

## Verification

- Backend tests cover runtime model bootstrap and document registry lifecycle.
- Frontend verification uses typecheck/build and manual polling/state checks.
