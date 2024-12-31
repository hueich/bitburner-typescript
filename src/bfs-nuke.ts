import { NS } from "@ns";
import { bfs } from 'bfs';
import { nuke } from 'nuke';

export async function main(ns: NS) {
  let numRoot = 0;
  bfs(ns, function (ns: NS, host: string) {
    if (nuke(ns, host)) {
      numRoot++;
    }
  });
  ns.printf('Have root on %d servers.', numRoot);
}