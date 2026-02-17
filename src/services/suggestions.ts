import type { Storage } from "../storage/storage.ts";

export type Suggestion = {
  id: number;
  text: string;
  sender: string;
  roomId: string;
  createdAt: string;
};

export type SuggestionsStore = {
  nextId: number;
  items: Suggestion[];
};

const DEFAULT_STORE: SuggestionsStore = {
  nextId: 1,
  items: [],
};

const STORAGE_KEY = "suggestions";

export async function addSuggestion(
  storage: Storage,
  text: string,
  sender: string,
  roomId: string,
  now: Date,
): Promise<Suggestion> {
  let created: Suggestion | undefined;
  await storage.update<SuggestionsStore>(
    STORAGE_KEY,
    (current: SuggestionsStore) => {
      created = {
        id: current.nextId,
        text,
        sender,
        roomId,
        createdAt: now.toISOString(),
      };
      return {
        nextId: current.nextId + 1,
        items: [...current.items, created],
      };
    },
    DEFAULT_STORE,
  );
  return created!;
}

export async function getSuggestions(
  storage: Storage,
): Promise<Suggestion[]> {
  const store = await storage.get<SuggestionsStore>(STORAGE_KEY);
  return store?.items ?? [];
}
