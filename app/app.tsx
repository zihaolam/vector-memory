import { createRoot } from "react-dom/client";
import React from "react";
import { createMemoryStore } from "./memory";

export const App = () => {
  const [input, setInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<string[]>([]);
  const [memories, setMemories] = React.useState<
    { content: string; createdAt: number; updatedAt?: number }[]
  >([]);
  const [memory] = React.useState(createMemoryStore);

  const refreshMemories = async () => {
    try {
      await memory.list().then(setMemories);
    } catch (error) {
      console.warn(error);
      setTimeout(() => refreshMemories(), 500);
    }
  };

  React.useEffect(() => {
    refreshMemories();
  }, []);

  return (
    <div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="memory"
      />
      <button
        onClick={() =>
          memory
            .add(input)
            .then(() => memory.list().then(() => refreshMemories()))
        }
      >
        Add memory
      </button>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="search memory"
      />
      <button
        onClick={() =>
          memory
            .search(search)
            .then((res) => setSearchResults(res.map((v) => v.content)))
        }
      >
        Search memory
      </button>
      <div>Memories:</div>
      <ul>
        {memories.map((res, idx) => (
          <li key={idx}>
            {res.content}, createdAt: {new Date(res.createdAt).toLocaleString()}
            ,{" "}
            {res.updatedAt
              ? `updatedAt: ${new Date(res.updatedAt).toLocaleString()}`
              : ""}
          </li>
        ))}
      </ul>

      <div>Search:</div>
      <ul>
        {searchResults.map((res, idx) => (
          <li key={idx}>{res}</li>
        ))}
      </ul>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
