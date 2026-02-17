import { assertEquals } from "@std/assert";
import { formatDurationMs } from "../../src/services/format.ts";

Deno.test("formatDurationMs: zero", () => {
  assertEquals(formatDurationMs(0), "0s");
});

Deno.test("formatDurationMs: sub-second rounds to 0s", () => {
  assertEquals(formatDurationMs(500), "0s");
});

Deno.test("formatDurationMs: seconds only", () => {
  assertEquals(formatDurationMs(5_000), "5s");
});

Deno.test("formatDurationMs: minutes and seconds", () => {
  assertEquals(formatDurationMs(90_000), "1m 30s");
});

Deno.test("formatDurationMs: hours, minutes, seconds", () => {
  assertEquals(formatDurationMs(3_661_000), "1h 1m 1s");
});

Deno.test("formatDurationMs: days", () => {
  assertEquals(formatDurationMs(90_061_000), "1d 1h 1m 1s");
});

Deno.test("formatDurationMs: negative clamps to 0", () => {
  assertEquals(formatDurationMs(-1000), "0s");
});

Deno.test("formatDurationMs: exactly 1 day", () => {
  assertEquals(formatDurationMs(86_400_000), "1d 0h 0m 0s");
});
