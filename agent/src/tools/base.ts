export interface ToolParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object';
    description: string;
    required: boolean;
}

export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
}

export abstract class Tool {
    abstract name: string;
    abstract description: string;
    abstract parameters: ToolParameter[];

    abstract execute(params: Record<string, any>): Promise<ToolResult>;

    validate(params: Record<string, any>): boolean {
        for (const param of this.parameters) {
            if (param.required && !(param.name in params)) {
                return false;
            }
        }
        return true;
    }
}
