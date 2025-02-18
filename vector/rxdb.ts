import type { Embedding } from "#/embeddings";
import { RxDBUpdatePlugin } from "rxdb/plugins/update";
import {
  createRxDatabase,
  type RxDatabase,
  type RxCollection,
  toTypedRxJsonSchema,
  type ExtractDocumentTypeFromTypedRxJsonSchema,
  sortByObjectNumberProperty,
  addRxPlugin,
} from "rxdb";
import type { EmbeddingResult, Entry, VectorStore } from "./vector";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { euclideanDistance } from "rxdb/plugins/vector";

const vectorSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: {
      type: "string",
      maxLength: 20,
    },
    content: {
      type: "string",
    },
    embedding: {
      type: "array",
      items: {
        type: "number",
      },
    },
    createdAt: {
      type: "number",
    },
    updatedAt: {
      type: "number",
    },
    metadata: {
      type: "object",
    },
  },
  required: ["id", "embedding", "content", "metadata", "createdAt"],
} as const;

const vectorSchemaTyped = toTypedRxJsonSchema(vectorSchema);
type Vector = ExtractDocumentTypeFromTypedRxJsonSchema<
  typeof vectorSchemaTyped
>;

type VectorCollection = RxCollection<Vector>;

interface Collections {
  vector: VectorCollection;
}

export class RxDbVector implements VectorStore {
  #db: RxDatabase<Collections> | null = null;
  #vector: VectorCollection | null = null;

  constructor() {
    this.initialize();
  }

  async initialize() {
    this.#db = await createRxDatabase({
      name: "default",
      storage: getRxStorageDexie(),
    });
    await this.#db.addCollections({
      vector: {
        schema: vectorSchema,
      },
    });

    addRxPlugin(RxDBUpdatePlugin);
    this.#vector = this.#db.vector;
  }

  getDb() {
    if (this.#db === null) {
      throw new Error("RxDb is not initialized yet");
    }
    return this.#db;
  }

  getVectorStore() {
    if (this.#vector === null) {
      throw new Error("Vector collection is not initialized yet");
    }
    return this.#vector;
  }

  async get(id: string): Promise<EmbeddingResult | null> {
    const vectorStore = this.getVectorStore();
    const record = await vectorStore.findOne(id).exec();

    if (record === null) return null;
    return record.toJSON() as EmbeddingResult;
  }

  async add(embeddings: Entry[]): Promise<EmbeddingResult[]> {
    const vectorStore = this.getVectorStore();
    const now = Date.now();
    const values = embeddings.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      metadata: e.metadata ?? {},
      createdAt: now,
    }));
    const docs = await vectorStore.bulkInsert(values);
    if (docs.error.length !== 0) {
      console.error(docs.error);
      throw docs.error;
    }
    return docs.success.map((r) => r.toJSON()) as EmbeddingResult[];
  }
  async update(embedding: EmbeddingResult): Promise<EmbeddingResult> {
    const vectorStore = this.getVectorStore();
    const record = await vectorStore
      .findOne({
        selector: {
          id: embedding.id,
        },
      })
      .exec();
    if (record === null) {
      throw new Error(`Vector with id ${embedding.id} not found`);
    }
    record.update({
      $set: {
        content: embedding.content,
        embedding: embedding.embedding,
        metadata: embedding.metadata,
        updatedAt: Date.now(),
      },
    });
    return embedding;
  }

  async delete(id: string): Promise<void> {
    const vectorStore = this.getVectorStore();
    const record = await vectorStore
      .findOne({
        selector: { id },
      })
      .exec();

    if (record === null) return;
    await record.remove();
  }

  async search(
    embedding: Embedding,
    opts?: { topK?: number; threshold?: number },
  ): Promise<EmbeddingResult[]> {
    const { topK = 5, threshold = 1 } = opts ?? {};
    const vectorStore = this.getVectorStore();
    const vectors = await vectorStore.find().exec();
    const distances = vectors.map((doc) => ({
      doc,
      distance: euclideanDistance(embedding, doc.embedding),
    }));
    const results = distances
      .filter((r) => r.distance <= threshold)
      .sort(sortByObjectNumberProperty("distance"))
      .toReversed()
      .slice(0, topK);
    return results.map((r) => r.doc.toJSON() as EmbeddingResult);
  }

  async list(props?: {
    cursor?: string;
    limit?: number;
  }): Promise<EmbeddingResult[]> {
    const vectorStore = this.getVectorStore();
    const records = await vectorStore
      .find({
        ...(props?.cursor
          ? {
              selector: {
                id: { $gte: props?.cursor ?? null },
              },
            }
          : {}),
        sort: [{ id: "asc" }],
        ...(props?.limit && { limit: props.limit }),
      })
      .exec();

    return records.map((r) => r.toJSON() as EmbeddingResult);
  }
}
