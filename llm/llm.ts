import { z } from "zod";

export interface LLM {
  generate<Schema extends z.ZodTypeAny>(prompt: {
    system?: string;
    user: string;
    schema: Schema;
  }): Promise<z.infer<Schema>>;
  generate(prompt: { system?: string; user: string }): Promise<string>;
}
