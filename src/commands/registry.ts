import type { CommandDefinition } from "./types.ts";

export class CommandRegistry {
  #commands = new Map<string, CommandDefinition>();

  register(definition: CommandDefinition): void {
    this.#commands.set(definition.name, definition);
  }

  get(name: string): CommandDefinition | undefined {
    return this.#commands.get(name);
  }

  list(): CommandDefinition[] {
    return Array.from(this.#commands.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }
}
