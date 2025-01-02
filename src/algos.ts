import { NS, Server } from "@ns";

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

export async function growWeaken(ns: NS, target: string, moneyRatio: number = 1.0, threads: number = 1) {
  ns.printf('Begin growing server "%s"...', target);
  const maxMoney = ns.getServerMaxMoney(target);
  const minSec = ns.getServerMinSecurityLevel(target);
  const secPerWeaken = 0.05;
  const maxSecDiff = 1.0;
  const secThresh = Math.min(secPerWeaken * threads, maxSecDiff);

  ns.printf('Server "%s" max money: %f', target, maxMoney);
  ns.printf('Server "%s" min security: %.3f', target, minSec);

  if (maxMoney <= 0) {
    ns.print('No money to be made here.');
    return;
  }

  while (true) {
    let secDiff = ns.getServerSecurityLevel(target) - minSec;
    ns.printf('Security difference: %.3f', secDiff)
    if (secDiff >= secThresh) {
      await ns.weaken(target, { threads: threads });
      continue;
    }

    let oldMoney = ns.getServerMoneyAvailable(target);
    let shouldGrow = false;

    ns.printf('Money difference: %f', maxMoney - oldMoney);
    if (moneyRatio === 1.0 && oldMoney < maxMoney) {
      shouldGrow = true;
    }

    let curMoneyRatio = oldMoney / maxMoney;
    ns.printf('Money difference percent: %s', ns.formatPercent(curMoneyRatio, 3));
    if (curMoneyRatio < moneyRatio) {
      shouldGrow = true;
    }

    if (shouldGrow) {
      await ns.grow(target, { threads: threads });
      let newMoney = ns.getServerMoneyAvailable(target);
      ns.printf('Grew by $%f', newMoney - oldMoney);
      continue;
    }

    await ns.weaken(target, { threads: threads });
    break;
  }

  ns.printf('Final server state:\n  MaxMoney: %f\n  CurMoney: %f\n  MinSec: %.3f\n  CurSec: %.3f', ns.getServerMaxMoney(target), ns.getServerMoneyAvailable(target), ns.getServerMinSecurityLevel(target), ns.getServerSecurityLevel(target));
}

export function listServers(ns: NS): Server[] {
  const servers: Server[] = [];
  bfs(ns, function (ns: NS, host: string) {
    servers.push(ns.getServer(host));
  });
  return servers;
}