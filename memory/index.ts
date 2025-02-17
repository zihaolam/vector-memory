import { z } from "zod";
import type { Embedder, Embedding } from "../embeddings";
import type { LLM } from "../llm";
import type { VectorStore, EmbeddingResult } from "../vector";
import { getUpdateMemoryPrompt, UpdateMemoryAction } from "./prompts";

export interface Memory {
  id: number;
  content: string;
  metadata: Record<string, any>;
}

export class MemoryStore {
  private vector: VectorStore;
  private embedder: Embedder;
  private llm: LLM;

  constructor({
    vector,
    embedder,
    llm,
  }: {
    vector: VectorStore;
    embedder: Embedder;
    llm: LLM;
  }) {
    this.vector = vector;
    this.embedder = embedder;
    this.llm = llm;
  }

  private async addMemory({
    content,
    existingEmbeddings,
    metadata,
  }: {
    content: string;
    existingEmbeddings: Record<string, Embedding>;
    metadata?: Record<string, any>;
  }) {
    const embeddings =
      content in existingEmbeddings
        ? existingEmbeddings[content]
        : await this.embedder.embed(content);
    return this.vector.add([{ embedding: embeddings, content, metadata }]);
  }

  private async updateMemory({
    memoryId,
    content,
    existingEmbeddings,
    metadata = {},
  }: {
    memoryId: number;
    content: string;
    existingEmbeddings: Record<string, Embedding>;
    metadata?: Record<string, any>;
  }) {
    const existingMemory = await this.vector.get(memoryId);
    if (!existingMemory) {
      return null;
    }

    const embedding = existingEmbeddings[content]
      ? existingEmbeddings[content]
      : await this.embedder.embed(content);

    return this.vector.update({
      id: memoryId,
      embedding,
      content,
      metadata,
    });
  }

  async search(content: string): Promise<EmbeddingResult[]> {
    const embedding = await this.embedder.embed(content);
    return this.vector.search(embedding);
  }

  async add(content: string): Promise<Memory[]> {
    const [existingRelevantMemories, { facts: newRetrievedFacts }] =
      await Promise.all([
        this.search(content),
        this.llm.generate({
          system: "facts",
          user: content,
          schema: z.object({ facts: z.array(z.string()) }),
        }),
      ]);

    const updateMemoryPrompt = getUpdateMemoryPrompt({
      newRetrievedFacts,
      oldMemory: existingRelevantMemories,
    });

    const newMessageEmbeddings: Record<string, Embedding> = {};
    const retrievedOldMemory: Memory[] = [];
    for (const fact of newRetrievedFacts) {
      const factEmbedding = await this.embedder.embed(fact);
      newMessageEmbeddings[fact] = factEmbedding;
      const existingMemories = await this.vector.search(factEmbedding);
      for (const memory of existingMemories) {
        retrievedOldMemory.push(memory);
      }
    }

    const tempIdMappings: Record<number, number> = {};
    // make ids easier for the llm to understand with auto-incremented integers, so no hallucination
    retrievedOldMemory.forEach((memory, i) => {
      tempIdMappings[memory.id] = i;
      retrievedOldMemory[i].id = i;
    });

    const newMemoriesWithActions = await this.llm.generate({
      user: updateMemoryPrompt,
      schema: z.object({
        actions: z.array(
          z.object({
            id: z.number(),
            text: z.string(),
            action: z.nativeEnum(UpdateMemoryAction),
          }),
        ),
      }),
    });

    const returnedMemories: Memory[] = [];

    for (const action of newMemoriesWithActions.actions) {
      switch (action.action) {
        case UpdateMemoryAction.ADD: {
          const memory = await this.addMemory({
            content: action.text,
            existingEmbeddings: newMessageEmbeddings,
          });
          returnedMemories.push(...memory);
          continue;
        }
        case UpdateMemoryAction.UPDATE: {
          const memory = await this.updateMemory({
            memoryId: tempIdMappings[action.id],
            content: action.text,
            existingEmbeddings: newMessageEmbeddings,
          });
          if (memory === null) {
            throw new Error("Memory not found");
          }
          returnedMemories.push(memory);
          continue;
        }
        case UpdateMemoryAction.DELETE: {
          await this.vector.delete(tempIdMappings[action.id]);
          continue;
        }
        case UpdateMemoryAction.NONE: {
          continue;
        }
      }
    }

    return returnedMemories;
  }

  list(props?: { offset: number; limit: number }) {
    return this.vector.list(props);
  }
}
