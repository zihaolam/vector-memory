import { GeminiEmbedder } from "./embeddings/gemini";
import { GeminiLLM } from "./llm/gemini";
import { MemoryStore } from "./memory";
import { TbVectorStore } from "./vector/tinkerbird";

const vector = new TbVectorStore({
  collectionName: "default",
});

if (process.env.GEMINI_API_KEY === undefined) {
  throw new Error("GEMINI_API_KEY is required");
}

const llm = new GeminiLLM(process.env.GEMINI_API_KEY);
const embedder = new GeminiEmbedder(process.env.GEMINI_API_KEY);

const memory = new MemoryStore({
  llm,
  embedder,
  vector,
});

