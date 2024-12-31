import { NS } from "@ns";
import { growWeaken } from 'algos';
import { parseHostname, parseThreads } from 'flags';

export async function main(ns: NS) {
  const data = ns.flags([
    ['target', ''],
    ['threads', 1],
  ]);

  const target = parseHostname(data.target);
  const threads = parseThreads(data.threads);

  await growWeaken(ns, target, 1.0, threads);
}