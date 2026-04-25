# Instructions for AI Agent: Phase 2 Execution

## Context
You are an expert Backend Engineer. We are building the Orchestration Layer (Phase 2) of "Echo Journal" for BearHacks 2026. 
The project is a Node.js/TypeScript Express server hosted on Vultr. It serves as the bridge between a Raspberry Pi edge device, a Next.js client, and several AI APIs (Gemma 4, Snowflake, ElevenLabs). 

The application architecture relies on handling arbitrary data transfers (images, audio blobs, JSON) from edge and client devices.

## Task
Build out the `src/services/` layer and integrate it with our existing `src/routes/api.ts`. 
Assume the routes currently use `multer` to accept incoming files, but the business logic for processing them is empty.

## Strict Requirements
1. **TypeScript Definitions:** Use strict typing. Create interfaces for the API responses expected from Gemma 4, Snowflake, and ElevenLabs.
2. **Gemma 4 Integration (`gemma.service.ts`):** Write a service that accepts raw text or image buffers. It must prompt the Gemma 4 model to return a strictly formatted JSON summary of the input.
3. **Snowflake Integration (`snowflake.service.ts`):** Write a service using the Snowflake SDK. Implement an `insertMemory` function for new records, and a query function leveraging `SNOWFLAKE.CORTEX.SUMMARIZE()` to pull historical summaries.
4. **ElevenLabs Integration (`audio.service.ts`):** Write a service that takes synthesized text from Gemma and returns an audio buffer or URL from ElevenLabs.
5. **Robust Error Handling:** Ensure that API rate limits, network timeouts, or failed LLM JSON parsing do not crash the Express server. Use try/catch blocks and proper HTTP error codes.

## Output Expected
Generate the TypeScript code for the three services mentioned above. Then, output the updated code for `api.ts` to show how these services are wired into the Express routes. Ensure all code is production-ready and optimized for a hackathon environment.
