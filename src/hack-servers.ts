import { NS, Server } from "@ns";
import { listServers } from 'algos';
import { parseHostname } from 'flags';
import { canBuyServer, getMaxPurchasableRam } from 'utils';

const ramLimits = new Map([
  ['n00dles', 512],
]);


function getServerScore(s: Server): number {
  const maxHackSkill = 1500;
  const maxMoney = s.moneyMax ?? 0;
  const minSec = s.minDifficulty ?? Infinity;
  const reqHackSkill = s.requiredHackingSkill ?? Infinity;
  const secMult = (100 - minSec) / 100;
  const skillMult = (maxHackSkill - reqHackSkill) / maxHackSkill;
  const hackFactor = secMult * skillMult;
  const growth = s.serverGrowth ?? 0;
  const growthLog = Math.min(0.0035, Math.log1p(0.03 / minSec)) * growth / 100;
  const growthFactor = Math.log(growth) / growthLog;
  const baseDiff = 500;
  const baseSkill = 50;
  const diffFactor = 2.5;
  let skillFactor = diffFactor * reqHackSkill * minSec + baseDiff;
  skillFactor /= maxHackSkill + baseSkill;
  const hackTimeFactor = 5 * skillFactor;
  // const score = (maxMoney * hackFactor / 1000000) / (growthFactor * hackTimeFactor);
  const score = (maxMoney / 1000000) / (growthFactor * hackTimeFactor);
  return score;
}

function makePurchasedHostname(ns: NS, target: string) {
  return ns.sprintf('burner-%s', target);
}

export async function main(ns: NS) {
  const data = ns.flags([
    ['controller', ''],
  ]);
  const controller = parseHostname(data.controller) || ns.getHostname();
  let targetServers = listServers(ns).filter(function (server): boolean {
    return server.hasAdminRights
      && !!server.moneyMax && server.moneyMax > 0;
  });

  targetServers.sort(function (a: Server, b: Server): number {
    return getServerScore(b) - getServerScore(a);
  })

  const listFilename = 'hack-servers-list.txt';
  ns.print('Target servers:');
  ns.write(listFilename, '', 'w');
  for (const s of targetServers) {
    ns.printf('  %s: %f', s.hostname, getServerScore(s));
    ns.write(listFilename, ns.sprintf('%s: %f\n', s.hostname, getServerScore(s)), 'a');
  }

  targetServers = targetServers.slice(0, ns.getPurchasedServerLimit());
  // TODO: Remove reserved hosts from unusedHosts.
  const unusedHosts = new Set(ns.getPurchasedServers());
  for (const target of targetServers) {
    const host = makePurchasedHostname(ns, target.hostname);
    if (!ns.serverExists(host) && canBuyServer(ns)) {
      const maxCost = ns.getPlayer().money / 50;
      const ram = getMaxPurchasableRam(ns, maxCost, 128, ramLimits.get(target.hostname));
      if (ram > 0) {
        if (!ns.purchaseServer(host, ram)) {
          ns.printf('Failed to purchase new server with host "%s" with RAM "%d"', host, ram);
        }
      }
    }

    if (ns.serverExists(host)) {
      unusedHosts.delete(host);
    }
  }

  // TODO: Repurpose unused host servers.
  for (const target of targetServers) {
    const host = makePurchasedHostname(ns, target.hostname);
    if (!ns.serverExists(host) && unusedHosts.size > 0) {
      const unusedHost = unusedHosts.keys().next();
    }


    // TODO: Check if hwgw is already running on host.
    // TODO: Run hwgw on host.
    // TODO: Remove host from unusedHosts list.
  }

}