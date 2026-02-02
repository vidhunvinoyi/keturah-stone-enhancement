import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { Agent } from './core/Agent.js';

async function main() {
    console.log('🤖 Keturah Agent v1.0');
    console.log('Type "exit" or "quit" to stop\n');

    const agent = new Agent();
    const rl = readline.createInterface({ input, output });

    while (true) {
        try {
            const userInput = await rl.question('You: ');

            if (!userInput.trim()) continue;

            if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
                console.log('👋 Goodbye!');
                rl.close();
                process.exit(0);
            }

            const response = await agent.run(userInput);
            console.log(`Agent: ${response}\n`);
        } catch (error) {
            console.error('Error:', error);
        }
    }
}

main().catch(console.error);
