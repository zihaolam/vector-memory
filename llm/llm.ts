import { z } from "zod";

export interface LLM {
  generate<Schema extends z.ZodTypeAny>(prompt: {
    system?: string;
    user: string;
    schema: Schema;
    model?: any;
  }): Promise<z.infer<Schema>>;
  generate(prompt: {
    system?: string;
    user: string;
    model?: any;
  }): Promise<string>;
}
