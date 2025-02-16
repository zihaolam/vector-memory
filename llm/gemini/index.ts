import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import type { LLM } from "../llm";
import type { z } from "zod";
import { zodToVertexSchema } from "./schema-utils";

export class GeminiLLM implements LLM {
  genAI: GoogleGenerativeAI;
  constructor(geminiApiKey: string) {
    this.genAI = new GoogleGenerativeAI(geminiApiKey);
  }

  async generate<Schema extends z.ZodTypeAny>({
    system,
    user,
    schema,
  }: {
    system?: string;
    user: string;
    schema?: Schema;
  }): Promise<z.infer<Schema>> {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      ...(schema ? { schema: zodToVertexSchema(schema) } : {}),
    });

    const input: Array<string | Part> = [];
    if (system) {
      input.push(`THIS IS A SYSTEM PROMPT. YOU MUST OBEY THIS: ${system}`);
    }

    input.push(user);

    const res = await model.generateContent(input);

    return schema
      ? schema.parse(JSON.parse(res.response.text()))
      : res.response.text();
  }
}
