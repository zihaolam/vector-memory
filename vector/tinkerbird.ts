import { VectorStore, type VectorStoreOptions } from "tinkerbird";
import type {
  VectorStore as BaseVectorStore,
  EmbeddingResult,
  Entry,
} from "./vector";
import type { Embedding } from "../embeddings";

export class TbVectorStore implements BaseVectorStore {
  #store: VectorStore | null = null;
  isLoaded = false;

  constructor(opts: VectorStoreOptions) {
    this.initialize(opts);
  }

  private async initialize(opts: VectorStoreOptions) {
    this.#store = await VectorStore.create(opts);
    this.isLoaded = true;
  }

  async getStore() {
    if (this.#store === null) {
      throw new Error("Vector store not loaded");
    }
    return this.#store;
  }

  async get(id: number) {
    const store = await this.getStore();
    const node = store.nodes.get(id);
    if (node === undefined) {
      return null;
    }
    return {
      id: node.id,
      embedding: Array.from(node.embedding),
      content: node.content,
      metadata: {},
    };
  }

  async add(embeddings: Entry[]) {
    const store = await this.getStore();
    const addedVectors: EmbeddingResult[] = [];
    for (const embedding of embeddings) {
      const vectorId = store.nodes.size;
      store.addVector(vectorId, embedding.embedding, embedding.content);
      addedVectors.push({
        id: vectorId,
        embedding: embedding.embedding,
        content: embedding.content,
        metadata: {},
      });
    }
    return addedVectors;
  }

  async update(embedding: EmbeddingResult) {
    const store = await this.getStore();
    const vector = store.nodes.get(embedding.id);
    if (vector === undefined) {
      throw new Error(`Vector with id ${embedding.id} not found`);
    }
    vector.embedding = new Float32Array(embedding.embedding);
    vector.content = embedding.content;
    return embedding;
  }

  async delete(id: number) {
    const store = await this.getStore();
    store.nodes.delete(id);
  }

  async search(embedding: Embedding, topK = 10) {
    const store = await this.getStore();
    const vectors = store.query(embedding, topK);
    return vectors.map((v) => ({
      ...v,
      embedding: Array.from(v.embedding),
      metadata: {},
    }));
  }
}
