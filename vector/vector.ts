import type { Embedding } from "../embeddings";

export interface Entry {
  embedding: Embedding;
  content: string;
  metadata?: Record<string, any>;
}

export interface EmbeddingResult {
  id: number;
  embedding: Embedding;
  content: string;
  metadata: Record<string, any>;
}

export interface VectorStore {
  get(id: number): Promise<EmbeddingResult | null>;
  add(embeddings: Entry[]): Promise<EmbeddingResult[]>;
  update(embedding: EmbeddingResult): Promise<EmbeddingResult>;
  delete(id: number): Promise<void>;
  // returns records sorted by relevance
  search(embedding: Embedding, topK?: number): Promise<EmbeddingResult[]>;
}
