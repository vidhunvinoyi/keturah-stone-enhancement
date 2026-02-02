import { IBrain, MockBrain } from './Brain.js';
import { Tool } from '../tools/base.js';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export class Agent {
    private brain: IBrain;
    private history: Message[] = [];
    private tools: Map<string, Tool> = new Map();

    constructor(brain?: IBrain) {
        this.brain = brain || new MockBrain();
    }

    registerTool(tool: Tool): void {
        this.tools.set(tool.name, tool);
    }

    async run(input: string): Promise<string> {
        // Add user message to history
        this.history.push({
            role: 'user',
            content: input,
            timestamp: new Date(),
        });

        // Process with brain
        const response = await this.brain.process(input, this.history);

        // Add assistant response to history
        this.history.push({
            role: 'assistant',
            content: response,
            timestamp: new Date(),
        });

        return response;
    }

    getHistory(): Message[] {
        return [...this.history];
    }

    clearHistory(): void {
        this.history = [];
    }
}
