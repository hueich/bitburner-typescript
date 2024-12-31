import { NS } from "@ns";

const maxPurchasableRam = 2 ** 20;

export function getFreeRam(ns: NS, host: string): number {
  return ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
}

export function copyScriptsFromHome(ns: NS, dest: string, scripts: string[]): boolean {
  if (dest === 'home') {
    return false;
  }
  return ns.scp(scripts, dest, 'home');
}

export function canBuyServer(ns: NS): boolean {
  return ns.getPurchasedServers().length < ns.getPurchasedServerLimit();
}

export function getMaxPurchasableRam(ns: NS, maxCost: number, minRam: number = 2, maxRam: number = maxPurchasableRam): number {
  if (minRam < 2 || Math.log2(minRam) % 1 !== 0) {
    return 0;
  }
  let ram = minRam;
  while (ram < maxRam && ns.getPurchasedServerCost(ram * 2) <= maxCost) {
    ram *= 2;
  }
  if (ram <= maxRam && ns.getPurchasedServerCost(ram) <= maxCost) {
    return ram;
  }
  return 0;
}