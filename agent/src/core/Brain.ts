import { Message } from './Agent.js';

export interface IBrain {
    process(input: string, history: Message[]): Promise<string>;
}

/**
 * Mock Brain - Simulates AI responses without requiring API keys
 * Replace this with OpenAIBrain, AnthropicBrain, etc. when ready
 */
export class MockBrain implements IBrain {
    async process(input: string, history: Message[]): Promise<string> {
        // Simulate thinking delay
        await new Promise(resolve => setTimeout(resolve, 500));

        const lowerInput = input.toLowerCase();

        // Simple pattern matching
        if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
            return "Hello! I'm a mock AI agent. I can help you with basic tasks.";
        }

        if (lowerInput.includes('help')) {
            return `I'm a demonstration agent. Available commands:
- Ask me anything (I'll echo with context)
- Type "history" to see conversation history
- Type "exit" to quit`;
        }

        if (lowerInput.includes('history')) {
            if (history.length === 0) {
                return 'No conversation history yet.';
            }
            return `Conversation has ${history.length} messages. Last ${Math.min(3, history.length)} messages:\n` +
                history.slice(-3).map(m => `[${m.role}]: ${m.content}`).join('\n');
        }

        // Default response
        return `You said: "${input}". I'm a mock brain, so I can't do much yet. Try asking for "help"!`;
    }
}

/**
 * Example structure for a real LLM integration
 */
export class OpenAIBrain implements IBrain {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async process(input: string, history: Message[]): Promise<string> {
        // TODO: Implement OpenAI API call
        // const response = await fetch('https://api.openai.com/v1/chat/completions', {
        //   method: 'POST',
        //   headers: {
        //     'Authorization': `Bearer ${this.apiKey}`,
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify({
        //     model: 'gpt-4',
        //     messages: history.map(m => ({ role: m.role, content: m.content })),
        //   }),
        // });
        throw new Error('OpenAIBrain not implemented yet');
    }
}
