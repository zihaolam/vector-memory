import type { Embedder } from "./embedding";

export class GeminiEmbedder implements Embedder {
  endpoint: string;
  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async embed(contents: string[]): Promise<number[][]> {
    const result: { embeddings: number[][] } = await fetch(
      `${this.endpoint}/embed`,
      {
        method: "POST",
        body: JSON.stringify({ contents }),
      },
    ).then((r) => r.json());
    return result.embeddings;
  }
}
