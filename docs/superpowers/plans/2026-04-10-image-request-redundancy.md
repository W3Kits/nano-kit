# Image Request Redundancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dual OpenAI and Gemini request fields to all image-related API payloads while leaving pure text requests unchanged.

**Architecture:** Centralize image payload construction in one shared service helper and keep existing endpoints, headers, and response parsing paths intact. Update each image-related caller to consume the shared helper so redundancy rules stay consistent.

**Tech Stack:** TypeScript, Vitest, Vite

---

### Task 1: Add failing payload-builder tests

**Files:**
- Create: `src/services/image-payloads.test.ts`
- Test: `src/services/image-payloads.test.ts`

- [ ] **Step 1: Write the failing test**

Cover image generation and image edit payloads and assert that each built payload contains both `messages` and `contents`, plus both OpenAI and Gemini image config fields.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/image-payloads.test.ts`
Expected: FAIL because the builder file does not exist yet.

### Task 2: Implement shared redundant image payload builder

**Files:**
- Create: `src/services/image-payloads.ts`
- Test: `src/services/image-payloads.test.ts`

- [ ] **Step 1: Write minimal implementation**

Add helpers for prompt/image conversion and a builder that returns one JSON body containing both protocol shapes.

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- src/services/image-payloads.test.ts`
Expected: PASS

### Task 3: Wire image generation and edit services

**Files:**
- Modify: `src/services/api.ts`
- Modify: `src/services/image-generation.ts`
- Modify: `src/services/image-edit.ts`
- Modify: `src/services/image-edit.test.ts`
- Create: `src/services/image-generation.test.ts`

- [ ] **Step 1: Write the failing integration tests**

Assert outgoing request bodies contain dual-schema fields in image generation and image edit flows.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/services/image-generation.test.ts src/services/image-edit.test.ts`
Expected: FAIL until the service files adopt the shared builder.

- [ ] **Step 3: Update service callers**

Replace handwritten payloads with the shared redundant payload builder in all image-related entry points.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/services/image-generation.test.ts src/services/image-edit.test.ts src/services/image-payloads.test.ts`
Expected: PASS

### Task 4: Final verification

**Files:**
- Modify: `src/services/api.ts`
- Modify: `src/services/image-generation.ts`
- Modify: `src/services/image-edit.ts`
- Modify: `src/services/image-edit.test.ts`
- Create: `src/services/image-generation.test.ts`
- Create: `src/services/image-payloads.test.ts`

- [ ] **Step 1: Run focused verification**

Run: `npm test -- src/services/image-payloads.test.ts src/services/image-generation.test.ts src/services/image-edit.test.ts`
Expected: PASS
