# Vision Statement

## Problem

OpenWebUI communicates using the OpenAI API format (JSON), while the proprietary iaedu.pt API expects multipart/form-data and returns a stream of JSON objects (NDJSON). This incompatibility prevents direct integration between OpenWebUI and iaedu.pt. Additionally, there is a need for a multi-tenant solution that can serve multiple clients/tenants with different API keys, channel IDs, and agent configurations through a single adapter instance.

## Solution

A Node.js adapter server that acts as a middleware "bridge" to translate between these two formats in real-time with multi-tenant capabilities:

- Converts OpenAI-format requests to iaedu.pt's multipart/form-data format
- Converts iaedu.pt's NDJSON response stream to OpenAI's text/event-stream (SSE) format
- Manages session state by generating unique thread_ids for each request (configurable)
- Supports multi-tenancy by receiving API Key, Channel ID, and Agent ID via HTTP headers
- Secures API credentials by accepting them through request headers (no hardcoding)
- Provides health check endpoint for monitoring

## Value Proposition

Enables seamless integration of OpenWebUI with iaedu.pt's AI services, providing users with:

- Familiar OpenWebUI interface backed by iaedu.pt's specialized models
- Multi-tenant architecture allowing multiple clients to share the same adapter instance
- Real-time streaming responses for interactive chat experience
- Flexible configuration through HTTP headers (no service restarts needed for credential changes)
- Secure handling of API keys without hardcoding or environment variables in service files
