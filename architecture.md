# Echo Journal - Architecture & Tech Stack

## 1. System Design
Echo Journal operates on a Producer-Consumer architecture. The Raspberry Pi (Edge) and the Next.js Web App (Client) act as producers of raw life data. The Node.js backend hosted on Vultr acts as the Orchestrator, consuming this data and processing it through third-party AI APIs.

## 2. Tech Stack Overview
- **Edge:** Raspberry Pi Zero 2 W, ReSpeaker 2-Mics Pi HAT, Python 3.
- **Cloud Provider:** Vultr (Compute Instance & Object Storage).
- **Backend:** Node.js, Express, TypeScript.
- **Identity:** Auth0 (OAuth & Device Authorization Grant).
- **Intelligence:** Google Gemma 4 (Vision & Language capabilities).
- **Database:** Snowflake (Hybrid Tables & Cortex AI).
- **Voice:** ElevenLabs API.
- **Frontend:** Next.js, React, GraphQL.

## 3. Communication Protocols
- **Pi <-> Backend:** WebSockets for real-time LED state syncing; REST (Multipart Form) for audio chunks.
- **Web App <-> Backend:** GraphQL for complex feed queries; REST for arbitrary image/file uploads.
- **Backend <-> APIs:** REST over HTTPS.

## 4. Data Flow (The "Echo" Cycle)
1. **Capture:** A photo is uploaded via the Next.js app, or audio is spoken to the Raspberry Pi.
2. **Ingest:** The Node.js API catches the file via `multer` and temporarily holds it, or stores it in Vultr Object Storage.
3. **Process:** Gemma 4 Vision extracts metadata/context from the photo. An STT service extracts text from the audio. The resulting JSON is saved to Snowflake's `raw_events` table.
4. **Synthesize:** Gemma 4 generates a 1st-person narrative from all daily JSON fragments.
5. **Store:** The narrative is saved to the Snowflake `daily_journals` table.
6. **Vocalize:** ElevenLabs generates an MP3 of the narrative. The Pi downloads the audio buffer and plays it via the ReSpeaker HAT.
