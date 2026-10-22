import fs from "fs/promises";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { Memory, MemoryTransaction } from "./src/lib/memoryTypes";

const MEMORY_FILE = path.join(process.cwd(), "memories.json");

// Safe file operations with fallback
export async function loadMemories(): Promise<Memory[]> {
  try {
    const data = await fs.readFile(MEMORY_FILE, "utf-8");
    return JSON.parse(data) as Memory[];
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return [];
    }
    console.error("[ARCH Memory] Error loading memories, returning fallback:", error);
    return [];
  }
}

export async function saveMemories(memories: Memory[]): Promise<void> {
  try {
    await fs.writeFile(MEMORY_FILE, JSON.stringify(memories, null, 2), "utf-8");
    console.log(`[ARCH Memory] Saved ${memories.length} memories successfully.`);
  } catch (error) {
    console.error("[ARCH Memory] Error writing memory file:", error);
  }
}

export async function clearAllMemories(): Promise<void> {
  try {
    await fs.writeFile(MEMORY_FILE, JSON.stringify([], null, 2), "utf-8");
    console.log("[ARCH Memory] Completely wiped all persistent memories.");
  } catch (error) {
    console.error("[ARCH Memory] Error clearing memory file:", error);
  }
}

// Format memory core to system instruction injections
export function formatSystemInstructionsWithMemories(baseInstruction: string, memories: Memory[]): string {
  if (memories.length === 0) {
    return (
      baseInstruction +
      "\n\n" +
      "=== ARCH PERSISTENT MEMORY MATRIX ===\n" +
      "No historical recollections exist for this session yet (clean reset slate).\n" +
      "As you operate, log verified user preferences, active code projects, and device settings naturally.\n" +
      "====================================\n"
    );
  }

  // Group by category
  const grouped: Record<string, string[]> = {};
  memories.forEach((m) => {
    grouped[m.category] = grouped[m.category] || [];
    grouped[m.category].push(m.text);
  });

  let memoryBlock =
    "\n\n" +
    "=== ARCH PERSISTENT MEMORY MATRIX (STORED USER CONTEXT) ===\n" +
    "Below are your persistent records regarding the user, their device setup, and ongoing projects.\n" +
    "CRITICAL PROTOCOL:\n" +
    "- INTEGRATE INSTINCTIVELY: Address the user respectfully as 'Sir' (or by their preferred name if established) and seamlessly recall their preferences, active projects, and device workflow.\n\n" +
    "CURRENT ACTIVE RECORDS:\n";

  const categoriesOrdered = [
    { key: "identity", label: "User Identity & Title" },
    { key: "preference", label: "Preferences (e.g. Preferred Mobile Editor: Pydroid 3 / HopeWeb)" },
    { key: "goal", label: "Active Directives & Goals" },
    { key: "project", label: "Ongoing Projects & Repositories" },
    { key: "relationship", label: "Known Contacts (WhatsApp / Comms)" },
    { key: "behavior", label: "Operational Preferences & Behavioral Tendencies" },
  ];

  categoriesOrdered.forEach((cat) => {
    const list = grouped[cat.key] || [];
    if (list.length > 0) {
      memoryBlock += `* ${cat.label}:\n` + list.map((t) => `  - ${t}`).join("\n") + "\n";
    }
  });

  memoryBlock += "============================================================\n";

  return baseInstruction + memoryBlock;
}

// Background memory consolidation queue lock
let isConsolidating = false;

export async function processConversationSlice(
  apiKey: string,
  dialogueHistory: { role: string; text: string }[]
): Promise<Memory[] | null> {
  if (isConsolidating) {
    console.log("[ARCH Memory] Consolidation loop busy, skipping slice processing");
    return null;
  }

  if (dialogueHistory.length < 2) {
    return null;
  }

  isConsolidating = true;
  console.log("[ARCH Memory] Initiating pipeline for dialogue slice of length:", dialogueHistory.length);

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const currentMemories = await loadMemories();

    // Format memory map to help model understand what to edit
    const memoryContext = currentMemories
      .map((m) => `ID: ${m.id} | Category: ${m.category} | Fact: ${m.text}`)
      .join("\n");
    const dialogueContext = dialogueHistory
      .map((line) => `${line.role === "user" ? "User" : "ARCH"}: ${line.text}`)
      .join("\n");

    const prompt = `You are ARCH's cognitive memory engine. Your task is to analyze the recent dialogue against persistent user records and output precise update transactions.

### OBJECTIVE
Identify durable facts: user technical preferences (e.g. mobile editors like Pydroid 3, HopeWeb, preferred languages), active projects, system directives, contacts, and workflow habits.
Avoid cataloging small talk, greetings, or fleeting conversational filler.

### CURRENT USER MEMORIES:
${memoryContext || "(No memory records exist)"}

### RECENT DIALOGUE SLICE:
${dialogueContext}

### RULES
- ACTIONS:
  - "ADD": If new material information is introduced (e.g. user says 'I use Pydroid 3 for Python development' and it's not present).
  - "UPDATE": If previous information has evolved or is corrected. Provide the exact ID of the memory to replace.
  - "REMOVE": If a record was explicitly disproven or the user requested to forget it.
- TEXT STYLE: Express the memories as clean, concise, third-person declarative summaries (e.g., 'The user develops in Python using Pydroid 3.', 'The user prefers HopeWeb for mobile HTML projects.').
- ID: For ADD, leave blank. For UPDATE or REMOVE, provide the exact 'id' from the "Current user memories" list.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  action: {
                    type: Type.STRING,
                    description: "ADD, UPDATE, or REMOVE transaction.",
                    enum: ["ADD", "UPDATE", "REMOVE"],
                  },
                  id: {
                    type: Type.STRING,
                    description: "Specific ID of the existing memory being modified or deleted (leave blank/null for ADD).",
                  },
                  category: {
                    type: Type.STRING,
                    description: "The Memory category classification.",
                    enum: ["identity", "preference", "goal", "project", "relationship", "emotional", "behavior"],
                  },
                  text: {
                    type: Type.STRING,
                    description: "The memory summarized as a concise declarative statement in third-person.",
                  },
                },
                required: ["action", "category", "text"],
              },
            },
          },
          required: ["transactions"],
        },
      },
    });

    const resultText = response.text?.trim() || "{}";
    const resultObj = JSON.parse(resultText);
    const transactions: MemoryTransaction[] = resultObj.transactions || [];

    if (transactions.length === 0) {
      console.log("[ARCH Memory] Zero transactions generated. Ignored routine conversations.");
      isConsolidating = false;
      return null;
    }

    console.log(`[ARCH Memory] Processing ${transactions.length} memory updates:`, JSON.stringify(transactions));

    let updatedMemories = [...currentMemories];
    const timestamp = new Date().toISOString();

    for (const trx of transactions) {
      if (trx.action === "ADD") {
        const newMemory: Memory = {
          id: Math.random().toString(36).substring(2, 11),
          category: trx.category,
          text: trx.text,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        updatedMemories.push(newMemory);
      } else if (trx.action === "UPDATE") {
        const tarIndex = updatedMemories.findIndex((m) => m.id === trx.id);
        if (tarIndex !== -1) {
          updatedMemories[tarIndex] = {
            ...updatedMemories[tarIndex],
            category: trx.category,
            text: trx.text,
            updatedAt: timestamp,
          };
        } else {
          const newMemory: Memory = {
            id: Math.random().toString(36).substring(2, 11),
            category: trx.category,
            text: trx.text,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          updatedMemories.push(newMemory);
        }
      } else if (trx.action === "REMOVE") {
        updatedMemories = updatedMemories.filter((m) => m.id !== trx.id);
      }
    }

    await saveMemories(updatedMemories);
    isConsolidating = false;
    return updatedMemories;
  } catch (error) {
    console.error("[ARCH Memory] Consolidation failure:", error);
    isConsolidating = false;
    return null;
  }
}
