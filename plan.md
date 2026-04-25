# Echo Journal - Implementation Plan

## Phase 1: Edge Layer (Hardware & Python)
**Goal:** Establish the physical interface and "Alexa-like" behavior.
- **Hardware Assembly:** Connect ReSpeaker 2-Mics HAT and 0.96" I2C OLED to the Raspberry Pi Zero 2 W.
- **Wakeword Engine:** Implement Picovoice Porcupine for local "Hey Echo" detection without cloud latency.
- **Audio I/O:** Setup ALSA. Record `.wav` files when wakeword triggers; play synthesized `.mp3` files via the I2S DAC.
- **Network:** Implement a WebSocket client for real-time LED status updates and a REST client for POSTing audio payloads to the backend.

## Phase 2: Orchestration Layer (Node.js / Vultr)
**Goal:** Build the central nervous system to route arbitrary data.
- **Setup:** Initialize an Express.js server with TypeScript, intended for deployment on Vultr Compute.
- **Authentication:** Implement the Auth0 Device Authorization Grant flow for secure Pi-to-Server pairing.
- **Ingestion:** Configure `multer` middleware to handle multipart/form-data for image and audio uploads.
- **Routing:** Define core API endpoints for edge uploads (`/edge/audio`), client uploads (`/client/image`), and the nightly sync (`/orchestrate/summary`).

## Phase 3: Cognitive & Storage Layer (Gemma 4 & Snowflake)
**Goal:** Transform raw arbitrary media into structured, queryable memory.
- **Vision Pipeline:** Route image payloads to the Gemma 4 Vision API for context extraction.
- **Database Setup:** Configure Snowflake Hybrid Tables (Unistore) to handle both rapid inserts and complex queries.
- **Nightly Synthesis:** Create a cron job to aggregate daily transcripts and image contexts, passing them to Gemma 4 for narrative generation.
- **Memory Retrieval:** Implement Snowflake Cortex SQL functions (`SNOWFLAKE.CORTEX.SUMMARIZE`) for the client feed.

## Phase 4: Client Layer (Next.js)
**Goal:** Provide a visual dashboard and manual input method.
- **Framework:** Next.js (React) deployed via Vultr App Platform.
- **Pairing UI:** Build the Auth0 device pairing screen to link the hardware to the web account.
- **Uploads:** Create a mobile-friendly photo upload component.
- **The Chronicle Feed:** Construct a GraphQL-driven timeline displaying uploaded images alongside the synthesized text and audio summaries.
