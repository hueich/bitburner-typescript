import { NS } from "@ns";
import { parseHostname, parseThreads } from 'flags';
import { copyScriptsFromHome, getFreeRam } from 'utils';

const growWeakenScript = 'grow-weaken.ts';

const hostScripts = [
  growWeakenScript,
  'algos.ts',
  'flags.ts',
];

export async function main(ns: NS) {
  const data = ns.flags([
    ['target', ''],
    ['host', ''],
  ]);

  const target = parseHostname(data.target);
  const host = parseHostname(data.host) || ns.getHostname();

  copyScriptsFromHome(ns, host, hostScripts);

  const threads = Math.floor(getFreeRam(ns, host) / ns.getScriptRam(growWeakenScript));
  ns.exec(growWeakenScript, host, { threads: threads }, '--target', target, '--threads', threads);
}