import { NS } from "@ns";
import { bfs } from 'bfs';

export async function main(ns: NS) {
  const data = ns.flags([
    ['e', []],
  ]);

  const exclude = Array.isArray(data.e) ? data.e : [];

  bfs(ns, function (ns: NS, host: string) {
    const script = 'hack-simple.ts';
    const ramCost = ns.getScriptRam(script) - 0.8;
    ns.scp(script, host);
    ns.exec(script, host, { ramOverride: ramCost });
  }, exclude);
}