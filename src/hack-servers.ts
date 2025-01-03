import { NS, Server } from "@ns";
import { listServers } from 'algos';
import { parseBoolean, parseHostname, parseNumber } from 'flags';
import { canBuyServer, getMaxPurchasableRam, getMaxUpgradableRam } from 'utils';

const hwgwControllerScript = 'hwgw-controller.ts';

const purchasableHostnamePrefix = 'burner-';

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

function makePurchasedHostname(target: string): string {
  return purchasableHostnamePrefix + target;
}

function getTargetFromHostname(host: string): string {
  return host.startsWith(purchasableHostnamePrefix) ? host.substring(purchasableHostnamePrefix.length) : '';
}

export async function main(ns: NS) {
  const data = ns.flags([
    ['controller', ''],
    ['maxServerCost', 0],
    ['dryrun', false],
  ]);
  const controller = parseHostname(data.controller) || ns.getHostname();
  const maxServerCost = parseNumber(data.maxServerCost) || ns.getPlayer().money / 250;
  const dryrun = parseBoolean(data.dryrun);

  let targetServers = listServers(ns, /*excludeOwned=*/true).filter(function (server): boolean {
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

  if (dryrun) {
    return;
  }

  targetServers = targetServers.slice(0, ns.getPurchasedServerLimit());
  // TODO: Remove reserved hosts from unusedHosts.
  const unusedHosts = new Set(ns.getPurchasedServers());
  for (const target of targetServers) {
    const host = makePurchasedHostname(target.hostname);
    if (!ns.serverExists(host) && canBuyServer(ns)) {
      const ram = getMaxPurchasableRam(ns, maxServerCost, 128, ramLimits.get(target.hostname));
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

  const hwgwProcs: { pid: number, target: string, host: string }[] = [];
  for (const proc of ns.ps(controller)) {
    if (proc.filename !== hwgwControllerScript || proc.args.length === 0) {
      continue;
    }
    const p = {
      pid: proc.pid,
      target: '',
      host: '',
    }
    for (let i = 0; i < proc.args.length; i++) {
      if (proc.args[i] === '--target') {
        p.target = parseHostname(proc.args[i + 1]);
        i++;
        continue;
      } else if (proc.args[i] === '--host') {
        p.host = parseHostname(proc.args[i + 1]);
        i++;
        continue;
      }
    }
    hwgwProcs.push(p);
  }

  for (const target of targetServers) {
    const host = makePurchasedHostname(target.hostname);
    while (!ns.serverExists(host) && unusedHosts.size > 0) {
      const unusedHost = Array.from(unusedHosts).pop();
      if (!!unusedHost) {
        unusedHosts.delete(unusedHost);
        if (!ns.serverExists(unusedHost)) {
          continue;
        }
        // Check if hwgw is already running on host and kill its controller.
        const proc = hwgwProcs.find(function (p) {
          return p.host === unusedHost;
        });
        if (!!proc) {
          ns.kill(proc.pid);
          ns.killall(proc.host);
        } else if (ns.serverExists(getTargetFromHostname(unusedHost)) || unusedHost.startsWith(purchasableHostnamePrefix)) {
          // Probably was used to hack a target but controller died.
          ns.killall(unusedHost);
        } else {
          // Probably used for something else. Pick another unused host.
          continue;
        }

        // Rename host.
        if (!ns.renamePurchasedServer(unusedHost, host)) {
          ns.printf('Failed to rename server "%s" to "%s"', unusedHost, host);
          continue;
        }

        // Upgrade host.
        // TODO: Make optional.
        const ram = getMaxUpgradableRam(ns, host, maxServerCost, ramLimits.get(target.hostname));
        if (ram > 0) {
          if (!ns.upgradePurchasedServer(host, ram)) {
            ns.printf('Failed to upgrade server with host "%s" to RAM "%d"', host, ram);
          }
        }
        break;
      }
    }

    if (!ns.serverExists(host)) {
      continue;
    }

    // Check if hwgw is already running on host.
    if (hwgwProcs.find(function (p) { return ns.isRunning(p.pid) && p.host === host && p.target === target.hostname; })) {
      continue;
    }

    // Run hwgw on host.
    ns.exec(hwgwControllerScript, controller, 1, '--target', target.hostname, '--host', host);
  }

}