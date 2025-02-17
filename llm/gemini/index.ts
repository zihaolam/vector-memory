import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import type { LLM } from "../llm";
import { z } from "zod";
import { zodToVertexSchema } from "./schema-utils";

import { createParser } from "eventsource-parser";
type Model = "gemini-1.5-flash" | "gemini-2.0-flash";
type GeminiContent = { role: "user" | "model"; parts: { text: string }[] };
type GeminiEvent = {
  candidates:
    | []
    | [
        {
          content: GeminiContent;
          finishReason?: "STOP";
        },
      ];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    promptTokensDetails: {
      modality: "TEXT" | "IMAGE" | "AUDIO";
      tokenCount: number;
    }[];
    candidatesTokensDetails: {
      modality: "TEXT" | "IMAGE" | "AUDIO";
      tokenCount: number;
    }[];
    modelVersion: string;
    createTime: string;
    responseId: string;
  };
};

export class GeminiLLM implements LLM {
  apiKey: string;
  constructor(geminiApiKey: string) {
    this.apiKey = geminiApiKey;
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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
      {
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: user }] }],
          ...(schema
            ? {
                generation_config: {
                  response_mime_type: "application/json",
                  response_schema: zodToVertexSchema(schema),
                },
              }
            : {}),
          ...(system
            ? {
                system_instructions: {
                  parts: { text: system },
                },
              }
            : {}),
        }),
      },
    );

    return schema
      ? schema.parse(JSON.parse(await response.text()))
      : response.text();
  }

  async streamText(params: {
    model: Model;
    body: {
      contents: GeminiContent[];
      systemInstruction?: {
        role: "system";
        parts: { text: string }[];
      };
      tools?: (
        | {
            functionDeclarations?: {
              name: string;
              description: string;
              parameters: z.Schema | ReturnType<typeof zodToVertexSchema>;
            }[];
            googleSearchRetrieval?: never;
            googleSearch?: never;
          }
        | {
            googleSearchRetrieval?: {
              mode: "MODE_UNSPECIFIED" | "MODE_DYNAMIC";
              dynamicThreshold: number;
            };
            googleSearch?: never;
            functionDeclarations?: never;
          }
        | {
            googleSearch?: {};
            googleSearchRetrieval?: never;
            functionDeclarations?: never;
          }
      )[];
      toolConfig?: {
        functionCallingConfig?: {
          mode: "AUTO" | "ANY" | "NONE";
          allowedFunctionNames: string[];
        };
      };
      generationConfig?: {
        temperature?: number;
        topP?: number;
        topK?: number;
        candidateCount?: 1;
        maxOutputTokens?: number;
        presencePenalty?: number;
        frequencyPenalty?: number;
        stopSequences?: string[];
        responseMimeType?: "application/json" | "text/plain";
        seed?: number;
      };
    };
  }) {
    const body = { ...params.body };

    for (const tool of body.tools ?? []) {
      for (const functionDeclaration of tool.functionDeclarations ?? []) {
        if (functionDeclaration.parameters instanceof z.Schema) {
          functionDeclaration.parameters = zodToVertexSchema(
            functionDeclaration.parameters,
          );
        }
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${this.apiKey}&alt=sse`,
      {
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (response.body === null) {
      throw new Error("Failed to get response body");
    }

    const stream = response.body.pipeThrough(
      new TextDecoderStream("utf-8", { fatal: true }),
    );

    const readable = new ReadableStream<GeminiEvent>({
      async start(controller) {
        const parser = createParser({
          onEvent(event) {
            controller.enqueue(JSON.parse(event.data));
          },
        });

        // @ts-expect-error
        for await (const chunk of stream) {
          parser.feed(chunk);
        }

        controller.close();
      },
    });

    let content = "";

    // @ts-expect-error
    for await (const chunk of readable) {
      const event = chunk as GeminiEvent;

      const text = event.candidates[0]?.content.parts[0]?.text;
      if (text !== undefined) {
        content += text;
      }

      if (event.candidates[0]?.finishReason === "STOP") {
        break;
      }
    }

    return content;
  }
}
