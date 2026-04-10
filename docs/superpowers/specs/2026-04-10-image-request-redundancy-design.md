# Image Request Redundancy Design

## Goal

For image-related API requests only, send both OpenAI-style and Gemini-style request fields in the same JSON body so compatibility gateways can match whichever schema they support.

## Scope

- In scope:
  - `src/services/api.ts` image chat generation flow
  - `src/services/image-generation.ts` image generation flow
  - `src/services/image-edit.ts` image edit flow
- Out of scope:
  - Pure text generation interfaces
  - Response parsing changes beyond existing compatibility handling

## Approach

Introduce a shared image payload builder that accepts a protocol-neutral image request shape and emits a body containing both:

- OpenAI-compatible fields such as `messages`, `stream`, `size`, `aspect_ratio`
- Gemini-compatible fields such as `contents`, `generationConfig`, `generationConfig.imageConfig`

Each caller will keep its existing endpoint and authentication style. Only payload construction becomes redundant.

## Mapping Rules

- Text prompt maps to both `messages[].content[].text` and `contents[].parts[].text`
- Images map to both `image_url` and `inline_data`
- Resolution maps to both OpenAI `size` and Gemini `generationConfig.imageConfig.imageSize`
- Aspect ratio maps to both `aspect_ratio` and `generationConfig.imageConfig.aspectRatio`
- When aspect ratio is `auto`, omit explicit ratio fields from both protocol sections
- Image edit flows reuse the same edit prompt text for both schemas

## File Changes

- Add `src/services/image-payloads.ts` for shared redundant builders
- Update existing image-related service files to use the builder
- Add or expand tests to assert dual-schema request payloads

## Testing

- Add request-construction tests for image generation
- Extend image edit tests to assert both schema families are present
- Add a focused test for chat image payload construction or extract the builder for direct tests
