import { RxDbVector } from "#/vector/rxdb";
import { GeminiEmbedder } from "#/embeddings/gemini";
import { GeminiLLM } from "#/llm/gemini";
import { MemoryStore } from "#/memory";

export const createMemoryStore = () => {
  const vector = new RxDbVector();

  const llm = new GeminiLLM("http://localhost:7444");
  const embedder = new GeminiEmbedder("http://localhost:7444");

  const memory = new MemoryStore({
    llm,
    embedder,
    vector,
  });

  return memory;
};
