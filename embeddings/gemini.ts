import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import type { Embedder } from "./embedding";

export class GeminiEmbedder implements Embedder {
  model: GenerativeModel;

  constructor(geminiApiKey: string) {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    this.model = genAI.getGenerativeModel({
      model: "text-embedding-004",
    });
  }

  private textToRequest(content: string) {
    return {
      content: { role: "user", parts: [{ text: content }] },
    };
  }

  async batchEmbed(contents: string[]): Promise<number[][]> {
    const result = await this.model.batchEmbedContents({
      requests: contents.map(this.textToRequest),
    });
    return result.embeddings.map((embedding) => embedding.values);
  }

  async embed(content: string): Promise<number[]> {
    const result = await this.model.embedContent(this.textToRequest(content));
    return result.embedding.values;
  }
}
