import { NS, ScriptArg } from "@ns";

export interface Flags {
  target: string,
  sleepMs: number,
  threads: number,
}

export function parseFlags(ns: NS): Flags {
  const data = ns.flags([
    // Hostname of target server.
    ['target', ''],
    // Number of milliseconds to sleep.
    ['sleepMs', 0],
    // Number of threads to use.
    ['threads', 1],
  ]);
  return {
    target: parseHostname(data.target),
    sleepMs: parseDuration(data.sleepMs),
    threads: parseThreads(data.threads),
  };
}

export function parseHostname(arg: string[] | ScriptArg): string {
  return typeof arg === 'string' ? arg : '';
}

export function parseDuration(arg: string[] | ScriptArg): number {
  return typeof arg === 'number' ? arg : 0;
}

export function parseThreads(arg: string[] | ScriptArg): number {
  return typeof arg === 'number' ? Math.max(Math.floor(arg), 1) : 1;
}