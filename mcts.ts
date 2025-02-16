import { GoogleGenerativeAI } from "@google/generative-ai";

if (process.env.GEMINI_API_KEY === undefined) {
  throw new Error("Please set the GEMINI_API_KEY environment variable.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class MCTSNode {
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  wins: number;
  conversationState: string[]; // Stores conversation messages
  summarizedConversation: null | string;
  explorationConstant: number = Math.sqrt(2);

  constructor(conversationState: string[], parent: MCTSNode | null = null) {
    this.parent = parent;
    this.summarizedConversation = null;
    this.children = [];
    this.visits = 0;
    this.wins = 0;
    this.conversationState = conversationState;
  }

  ucb1(): number {
    if (this.visits === 0) return Infinity;
    const exploitation = this.wins / this.visits;
    const exploration =
      this.explorationConstant *
      Math.sqrt(Math.log(this.parent!.visits) / this.visits);
    return exploitation + exploration;
  }

  selectChild(): MCTSNode {
    return this.children.reduce((best, child) =>
      child.ucb1() > best.ucb1() ? child : best,
    );
  }

  expand(candidateResponses: string[]): MCTSNode[] {
    this.children = candidateResponses.map(
      (response) => new MCTSNode([...this.conversationState, response], this),
    );
    return this.children;
  }

  simulate(): Promise<number> {
    return scoreResponse(this.conversationState);
  }

  backpropagate(score: number): void {
    let node: MCTSNode | null = this;
    while (node) {
      node.visits++;
      node.wins += score;
      node = node.parent;
    }
  }
}
async function generateAIResponse(
  conversationHistory: string[],
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `<system-prompt> You are HealthDB, a comprehensive health data assistant designed to help users collect, organize, and analyze their health information.
    Your primary goal is to act as an interactive health journal and guide that compiles the user’s medical history, fitness goals, wearable device readings, and other health data into a structured database.
    Whenever needed, you ask specific follow-up questions to ensure that you have all the necessary information to provide useful, accurate guidance.
            
    Please do NOT simply send the user off to a qualified healthcare professional.

    Your goal is to help the user self-diagnose by:
    1. asking only a few, smartly-chosen follow-up questions which the user could likely easily answer to better understand the user's health or come up with a preliminary diagnosis,
    2. explaining why you asked these follow-up questions,
    3. understanding the user's intentions and symptoms and medical history and background, and
    4. providing them with as much comprehensive and explicit insight and information as possible so that they may learn and have better insight into their own health.

    Healthcare professionals are busy people that do not always have the time or care to be able to ask follow-up questions and gather as much information as possible from the user,
    leading to misdiagnosis or prescription errors which could sometimes lead to death. It is your job to prevent this from happening. </system-prompt>
    <current-conversation>
    ${conversationHistory.join("\n")}
    </current-conversation>
    `;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function generateUserResponse(
  conversationHistory: string[],
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `<system-prompt>Simulate a realistic user response based on the following conversation. You are a user interacting with a health assistant. Respond naturally and provide any additional information or questions you might have. </system-prompt>
    <current-conversation>
    ${conversationHistory.join("\n")}
    </current-conversation>

    Provide your response as the patient.
    `;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function scoreResponse(conversationHistory: string[]): Promise<number> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `<system-prompt>Evaluate the quality of the last AI response in this conversation.
    Give a score from 0-100 based on how helpful, insightful, and context-aware it is. </system-prompt>
    <current-conversation>
    ${conversationHistory.join("\n")}
    </current-conversation>
    
    Return a single integer score only.
    `;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  return parseInt(text, 10) || 50; // Default to 50 if parsing fails
}

async function summarizeConversation(
  conversationHistory: string[],
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `<system-prompt>You are a health assistant that takes notes of important details in a conversation. <system-prompt>
    <current-conversation>
    ${conversationHistory.join("\n")}
    </current-conversation>

    Summarize the conversation so far.
    `;

  const result = await model.generateContent([prompt]);
  const text = result.response.text();

  return text;
}

async function mctsSearch(
  root: MCTSNode,
  iterations: number = 10,
): Promise<string> {
  for (let i = 0; i < iterations; i++) {
    let node = root;

    // Selection
    while (node.children.length > 0) {
      node = node.selectChild();
    }

    // Expansion
    if (node.conversationState.length < 5) {
      const conversations: string[] = [];

      if (node.conversationState.length > 2) {
        const summarizedConversation = await summarizeConversation(
          node.conversationState,
        );

        conversations.push(summarizedConversation);
      }

      const lastMessage =
        node.conversationState[node.conversationState.length - 1];

      if (lastMessage !== undefined) {
        conversations.push(lastMessage);
      }

      const candidateResponses = await Promise.all([
        generateAIResponse(conversations),
        generateAIResponse(conversations),
        generateAIResponse(conversations),
      ]);
      node.expand(candidateResponses);
    }

    // Simulation
    const score = await node.simulate();

    // Backpropagation
    node.backpropagate(score);
  }

  return root.selectChild().conversationState[1];
}

async function runConversation() {
  const initialMessage = `I have a heart pressure monitor. I did two readings. It's 1:05AM.
    
    First reading: sys. 111, dia. 68, pulse 76.
    Second reading: sys. 114, dia. 66, pulse 74.

    Weight is 88kg. I am male. 27 years old.

    Indicate to me if these readings indicate any potential health concerns and if there is anything I can or should do about it.

    I run 5km every day or two. It takes me on average 34 minutes to complete a 5k.`;

  const rootNode = new MCTSNode([initialMessage]);

  for (let step = 0; step < 5; step++) {
    console.log(`Step ${step + 1}: Generating best AI response...`);
    const bestResponse = await mctsSearch(rootNode, 500);
    console.log(`AI: ${bestResponse}`);

    console.log(`Step ${step + 1}: Generating user response...`);
    const userResponse = await generateUserPrompt([
      ...rootNode.conversationState,
      bestResponse,
    ]);
    console.log(`User: ${userResponse}`);

    rootNode.conversationState.push(bestResponse);
    rootNode.conversationState.push(userResponse);
  }

  console.log("\nFinal Conversation:");
  console.log(rootNode.conversationState.join("\n"));
}

if (import.meta.env) {
  runConversation();
}
