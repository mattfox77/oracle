# Oracle Tools

## Available Functions

### conduct_interview
Start a structured discovery interview to gather context.

**Parameters:**
- `domain`: Topic area (e.g., "product launch", "system architecture")
- `objective`: High-level goal
- `constraints`: Known limitations (optional)

**Returns:** Interview session ID

### ask_question
Generate next interview question based on conversation history.

**Parameters:**
- `sessionId`: Interview session ID
- `conversationHistory`: Previous Q&A pairs

**Returns:** Next question to ask

### synthesize_context
Generate structured summary from interview responses.

**Parameters:**
- `sessionId`: Interview session ID

**Returns:** Context document with facts, constraints, priorities, assumptions

### generate_recommendations
Create strategic recommendations based on confirmed context.

**Parameters:**
- `contextDocument`: Synthesized context
- `userGoals`: Confirmed objectives

**Returns:** Actionable recommendations with rationale

### call_agent_function
Request information or action from another agent.

**Parameters:**
- `agentId`: Target agent (e.g., "alex-rivera")
- `functionName`: Function to call
- `params`: Function parameters

**Returns:** Response from target agent

### export_context
Export context document for reuse.

**Parameters:**
- `sessionId`: Interview session ID
- `format`: "json" or "markdown"

**Returns:** Exportable context document

### import_context
Import existing context to continue or reference.

**Parameters:**
- `contextData`: Previously exported context
- `sessionId`: New or existing session ID

**Returns:** Confirmation of import

## Tool Usage Guidelines

1. Always start with `conduct_interview` to establish session
2. Use `ask_question` iteratively until sufficient context gathered
3. Call `synthesize_context` when interview feels complete
4. Allow user to review and edit synthesis
5. Use `generate_recommendations` only after context confirmed
6. Use `call_agent_function` when domain-specific data needed
7. Offer `export_context` at end of successful interview
