export type ParsedCommand = {
  name: string;
  args: string[];
  rawArgs: string;
};

export function parseCommand(
  body: string,
  prefix: string,
): ParsedCommand | null {
  if (!body.startsWith(prefix)) return null;
  const withoutPrefix = body.slice(prefix.length).trim();
  if (!withoutPrefix) return null;

  const parts = withoutPrefix.split(/\s+/);
  const name = parts[0]?.toLowerCase();
  if (!name) return null;

  const args = parts.slice(1);
  const rawArgs = withoutPrefix.slice(name.length).trim();
  return { name, args, rawArgs };
}
