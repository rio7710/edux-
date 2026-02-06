// src/tools/test.ts
import { z } from 'zod';

export const testEchoSchema = {
  message: z.string().describe('에코할 메시지'),
};

export async function testEchoHandler(args: { message: string }) {
  return {
    content: [{ type: 'text' as const, text: `Echo: ${args.message}` }],
  };
}
