# User Personas

## Primary User: Educator/Teacher

- **Role**: Teacher or instructor using iaedu.pt educational AI services
- **Goals**:
  - Use familiar OpenWebUI interface to access iaedu.pt's specialized educational models
  - Maintain conversation context across multiple chat sessions
  - Get real-time AI assistance for lesson planning, student queries, and educational content
- **Pain Points**:
  - Current iaedu.pt API requires technical knowledge to integrate
  - No native OpenWebUI support for iaedu.pt's proprietary format
  - Difficulty managing conversation threads manually
  - Need for secure handling of API credentials without exposing them in configurations

## Secondary User: Student/Learner

- **Role**: Student using iaedu.pt for educational assistance
- **Goals**:
  - Access AI tutoring through a user-friendly chat interface
  - Continue conversations with context preservation
  - Receive timely responses for homework help and study questions
- **Pain Points**:
  - Complex API integration prevents easy access to educational AI
  - Lack of persistent chat history disrupts learning flow
  - Need for simple, familiar chat interface
  - Requirement for secure handling of credentials

## Tertiary User: System Administrator

- **Role**: IT staff managing the OpenWebUI and adapter deployment
- **Goals**:
  - Deploy and maintain the adapter service with minimal ongoing maintenance
  - Ensure secure handling of API credentials
  - Monitor service health and performance
  - Support multiple tenants/clients with different configurations
- **Pain Points**:
  - Complex configuration and deployment processes
  - Security concerns with hardcoded API keys
  - Difficulty troubleshooting integration issues
  - Need to support multiple clients with different API keys/channel IDs
  - Desire for zero-downtime configuration updates

## New User: Platform/Service Provider

- **Role**: Team providing iaedu.pt services to multiple external clients
- **Goals**:
  - Offer iaedu.pt AI capabilities through a shared adapter infrastructure
  - Isolate client configurations and credentials
  - Provide scalable, multi-tenant service
  - Monitor usage and performance per tenant
- **Pain Points**:
  - Need to securely manage multiple client credentials
  - Desire to avoid deploying separate adapter instances per client
  - Requirement for tenant isolation and security
  - Need for usage tracking and monitoring capabilities
