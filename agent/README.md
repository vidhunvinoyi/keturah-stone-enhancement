# Keturah Agent

A standalone CLI AI agent with extensible tool system.

## Features

- 🤖 **Interactive REPL**: Chat with the agent in your terminal
- 🧠 **Pluggable Brain**: Swap between MockBrain (demo) and real LLM integrations (OpenAI, Anthropic, etc.)
- 🛠️ **Tool System**: Extensible architecture for adding custom capabilities
- 📝 **Conversation History**: Maintains context across messages

## Quick Start

### Prerequisites
- Node.js 22+ (or use the provided Dockerfile)

### Installation

```bash
cd agent
npm install
```

### Run

```bash
npm start
```

## Usage

```
🤖 Keturah Agent v1.0
Type "exit" or "quit" to stop

You: hello
Agent: Hello! I'm a mock AI agent. I can help you with basic tasks.

You: help
Agent: I'm a demonstration agent. Available commands:
- Ask me anything (I'll echo with context)
- Type "history" to see conversation history
- Type "exit" to quit
```

## Architecture

```
agent/
├── src/
│   ├── index.ts              # Entry point (REPL)
│   ├── core/
│   │   ├── Agent.ts          # Main agent logic
│   │   └── Brain.ts          # AI brain interface
│   └── tools/
│       ├── base.ts           # Tool base class
│       └── CalculatorTool.ts # Example tool
├── package.json
└── tsconfig.json
```

## Extending the Agent

### Add a Real LLM

Replace `MockBrain` with a real implementation:

```typescript
import { OpenAIBrain } from './core/Brain.js';

const agent = new Agent(new OpenAIBrain(process.env.OPENAI_API_KEY));
```

### Create Custom Tools

```typescript
import { Tool, ToolParameter, ToolResult } from './tools/base.js';

export class MyTool extends Tool {
  name = 'my_tool';
  description = 'Does something useful';
  parameters: ToolParameter[] = [
    { name: 'input', type: 'string', description: 'Input data', required: true }
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    // Your logic here
    return { success: true, data: { result: 'done' } };
  }
}
```

## Deployment

### Docker

```bash
docker build -t keturah-agent -f agent/Dockerfile .
docker run -it keturah-agent
```

### Manual

```bash
cd agent
npm install
npm start
```
