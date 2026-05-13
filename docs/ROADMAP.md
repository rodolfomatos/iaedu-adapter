# Roadmap

## Current Status (Completed)
- [x] Adapter server implementation (adapter-server.mjs)
- [x] Basic functionality: request/response conversion, session management
- [x] Security: API key from environment variables
- [x] Documentation: VISION, PERSONAS, REQUIREMENTS, ROADMAP

## Next Steps (Backlog)
### High Priority
- [ ] Implement environment file for API key (move from .service to .env)
- [ ] Add dynamic channel_id mapping (if API supports multiple channels)
- [ ] Enhance user_info mapping from OpenWebUI request
- [ ] Add input validation and sanitization

### Medium Priority
- [ ] Add rate limiting to prevent abuse
- [ ] Implement request/response logging to file (in addition to console)
- [ ] Add health check endpoint
- [ ] Improve error handling with more specific error codes

### Low Priority
- [ ] Add support for model selection (multiple models)
- [ ] Implement caching for frequent requests
- [ ] Add WebSocket support for real-time updates
- [ ] Create Docker container for easy deployment

## Long-term Ideas
- [ ] Open-source the adapter for community contributions
- [ ] Add support for other OpenWebUI-compatible APIs
- [ ] Implement machine learning for request routing optimization