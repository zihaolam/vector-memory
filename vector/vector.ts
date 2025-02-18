import type { Embedding } from "../embeddings";

export interface Entry {
  embedding: Embedding;
  content: string;
  metadata?: Record<string, any>;
}

export interface EmbeddingResult {
  id: string;
  embedding: Embedding;
  content: string;
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt?: number;
}

type UpdateableEmbeddingResult = Omit<
  EmbeddingResult,
  "createdAt" | "updatedAt"
>;

export interface VectorStore {
  get(id: string): Promise<EmbeddingResult | null>;
  add(embeddings: Entry[]): Promise<EmbeddingResult[]>;
  update(embedding: UpdateableEmbeddingResult): Promise<EmbeddingResult>;
  delete(id: string): Promise<void>;
  // returns records sorted by relevance
  search(
    embedding: Embedding,
    opts?: { threshold?: number; topK?: number },
  ): Promise<EmbeddingResult[]>;
  list(props?: { cursor?: string; limit?: number }): Promise<EmbeddingResult[]>;
}
