import Bun from "bun";
import { GoogleGenerativeAI, type ResponseSchema } from "@google/generative-ai";
import index from "./app/index.html";

if (process.env.GEMINI_API_KEY === undefined) {
  throw new Error("gemini_api_key not found");
}

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const PORT = 7444;

if (import.meta.env) {
  console.info(`Starting server at localhost:${PORT}`);
  Bun.serve({
    fetch: async (req) => {
      const url = new URL(req.url);
      switch (url.pathname) {
        case "/generate": {
          const {
            system,
            user,
            schema,
            model = "gemini-2.0-flash",
          } = (await req.json()) as {
            system?: string;
            user: string;
            schema?: ResponseSchema;
            model?: string;
          };
          const result = await gemini
            .getGenerativeModel({ model })
            .generateContent({
              contents: [{ role: "user", parts: [{ text: user }] }],
              ...(system ? { systemInstruction: system } : {}),
              ...(schema
                ? {
                    generationConfig: {
                      responseMimeType: "application/json",
                      responseSchema: schema,
                    },
                  }
                : {}),
            });

          return new Response(result.response.text());
        }
        case "/embed": {
          const { contents } = (await req.json()) as { contents: string[] };
          const result = await gemini
            .getGenerativeModel({ model: "text-embedding-004" })
            .batchEmbedContents({
              requests: contents.map((content) => ({
                content: { role: "user", parts: [{ text: content }] },
              })),
            });

          return new Response(
            JSON.stringify({
              embeddings: Array.from(result.embeddings.values()).map(
                (v) => v.values,
              ),
            }),
          );
        }
        default: {
          return new Response("", { status: 404 });
        }
      }
    },
    websocket: { message: () => {} },
    port: PORT,
    static: {
      "/": index,
    },
  });
}
