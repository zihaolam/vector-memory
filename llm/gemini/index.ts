import type { LLM } from "../llm";
import { z } from "zod";
import { zodToVertexSchema } from "./schema-utils";

type Model = "gemini-1.5-flash" | "gemini-2.0-flash";

export class GeminiLLM implements LLM {
  endpoint: string;
  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async generate<Schema extends z.ZodTypeAny>({
    system,
    user,
    schema,
    model = "gemini-2.0-flash",
  }: {
    system?: string;
    user: string;
    schema?: Schema;
    model?: Model;
  }): Promise<z.infer<Schema>> {
    const response = await fetch(`${this.endpoint}/generate`, {
      method: "POST",
      body: JSON.stringify({
        model,
        system,
        user,
        schema: schema ? zodToVertexSchema(schema) : undefined,
      }),
    });

    return schema
      ? schema.parse(JSON.parse(await response.text()))
      : response.text();
  }
}
