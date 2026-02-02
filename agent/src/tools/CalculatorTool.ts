import { Tool, ToolParameter, ToolResult } from './base.js';

export class CalculatorTool extends Tool {
    name = 'calculator';
    description = 'Performs basic arithmetic operations';
    parameters: ToolParameter[] = [
        {
            name: 'operation',
            type: 'string',
            description: 'Operation to perform: add, subtract, multiply, divide',
            required: true,
        },
        {
            name: 'a',
            type: 'number',
            description: 'First number',
            required: true,
        },
        {
            name: 'b',
            type: 'number',
            description: 'Second number',
            required: true,
        },
    ];

    async execute(params: Record<string, any>): Promise<ToolResult> {
        if (!this.validate(params)) {
            return {
                success: false,
                error: 'Missing required parameters',
            };
        }

        const { operation, a, b } = params;
        let result: number;

        try {
            switch (operation) {
                case 'add':
                    result = a + b;
                    break;
                case 'subtract':
                    result = a - b;
                    break;
                case 'multiply':
                    result = a * b;
                    break;
                case 'divide':
                    if (b === 0) {
                        return { success: false, error: 'Division by zero' };
                    }
                    result = a / b;
                    break;
                default:
                    return { success: false, error: 'Unknown operation' };
            }

            return {
                success: true,
                data: { result },
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}
