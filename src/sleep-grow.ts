import { NS } from "@ns";
import { parseFlags } from 'flags';

export async function main(ns: NS) {
  const flags = parseFlags(ns);
  ns.printf('Running grow() on "%s" using %d threads with %f ms delay', flags.target, flags.threads, flags.sleepMs);
  await ns.grow(flags.target, { additionalMsec: flags.sleepMs, threads: flags.threads });
}