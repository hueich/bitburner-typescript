import { NS } from "@ns";

export function bfs(ns: NS, callback: (ns: NS, host: string) => void, exclude?: string[]) {
  let queue = ns.scan('home');
  let visited = new Set<string>(['home']);

  if (exclude) {
    for (const e of exclude) {
      visited.add(e);
    }
  }

  for (let host = queue.shift(); host; host = queue.shift()) {
    if (visited.has(host)) {
      continue;
    }

    ns.printf('Visiting server "%s"...', host);
    visited.add(host);

    callback(ns, host);

    for (const h of ns.scan(host)) {
      if (!visited.has(h)) {
        queue.push(h);
      }
    }
  }

  ns.printf('Visited %d servers.', visited.size);
}