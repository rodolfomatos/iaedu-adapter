# Functional Requirements

## Core Functionality

1. **Request Format Conversion**
   - Convert OpenAI API JSON requests to iaedu.pt multipart/form-data format
   - Extract user message from OpenAI messages array
   - Handle system messages by prepending them to user message with separator
   - Generate unique thread_id for each request (using UUID) or use provided header
   - Receive channel_id and agent_id via HTTP headers (x-iaedu-channel-id, x-iaedu-agent-id)
   - Receive API key via HTTP header (x-iaedu-api-key or x-api-key)

2. **Response Format Conversion**
   - Convert iaedu.pt NDJSON stream to OpenAI text/event-stream (SSE) format
   - Parse each JSON line from the response stream
   - Extract token content and format as OpenAI completion chunks
   - Send proper [DONE] marker at stream completion

3. **Session Management**
   - Generate unique thread_id for each request using randomUUID() (format: req-{uuid})
   - Optionally use thread_id from header in future versions
   - Create user_info object with current timestamp and basic user context
   - No persistent session storage needed (stateless per request)

4. **Security & Multi-tenancy**
   - Receive API key via HTTP headers (x-iaedu-api-key or x-api-key) - never hardcoded
   - Receive channel_id via HTTP header (x-iaedu-channel-id) - required
   - Receive agent_id via HTTP header (x-iaedu-agent-id) - optional with default
   - Support multiple tenants/clients with different credentials through same adapter instance
   - Validate presence of required headers at request time
   - Return appropriate HTTP error codes (400) for missing required headers

## API Endpoints

1. **POST /v1/chat/completions**
   - Accepts OpenAI-format chat completion requests
   - Requires headers: x-iaedu-api-key (or x-api-key), x-iaedu-channel-id
   - Optional header: x-iaedu-agent-id (defaults to cmamvd3n40000c801qeacoad2)
   - Returns SSE-formatted streaming response
   - Handles conversation threading via generated UUID thread_id

2. **GET /v1/models**
   - Returns list of available models
   - Single model response with hardcoded model name
   - Required for OpenWebUI model discovery
   - No authentication required

3. **GET /health**
   - Health check endpoint for monitoring
   - Returns service status and version information
   - No authentication required
   - Indicates required and optional headers

## Non-Functional Requirements

### Performance

- Stream responses in real-time with minimal buffering
- Handle concurrent requests efficiently
- Timeout protection for upstream API calls (via fetch timeout mechanisms)
- Proper connection cleanup to prevent hanging
- Optimized connection settings: connectionTimeout: 0, keepAliveTimeout: 5000, setNoDelay(true)

### Reliability

- Graceful error handling for API failures
- Proper error responses to clients (400 for client errors, 500 for server errors)
- Stream termination on errors to prevent client hanging
- Logging of all significant events and errors
- Connection resilience with keep-alive and proper headers

### Scalability

- Stateless design (no server-side session storage)
- Horizontal scaling possible behind load balancer
- Resource cleanup after each request
- Multi-tenant architecture allows serving many clients from single instance

### Maintainability

- Clear separation of concerns in code
- Comprehensive logging for debugging
- Header-based configuration (no service restarts needed for credential changes)
- Minimal dependencies (only Fastify)
- Backward compatibility with OpenWebUI format expectations

## Configuration

The adapter is configured entirely through HTTP headers:

- **x-iaedu-api-key** (or x-api-key): Required - API key for iaedu.pt service
- **x-iaedu-channel-id**: Required - Channel ID for iaedu.pt service
- **x-iaedu-agent-id**: Optional - Agent ID for iaedu.pt service (defaults to cmamvd3n40000c801qeacoad2)

## Constraints

- Must run on Node.js 18+
- Must use Fastify web framework
- Must preserve exact iaedu.pt API endpoint and authentication method
- Must maintain backward compatibility with existing OpenWebUI configurations
- Must work with existing systemd service deployment model
- Must support multi-tenancy through header-based configuration
- Must not hardcode any credentials or configuration values
