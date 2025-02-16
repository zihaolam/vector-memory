export type Embedding = number[];

export interface Embedder {
  embed(content: string): Promise<Embedding>;
  batchEmbed(content: string[]): Promise<Embedding[]>;
}
