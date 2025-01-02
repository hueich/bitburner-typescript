import { NS } from "@ns";

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

export function getMaxPurchasableRam(ns: NS, maxCost: number, minRam: number = 2, maxRam?: number): number {
  if (minRam < 2 || Math.log2(minRam) % 1 !== 0) {
    return 0;
  }
  maxRam = Math.min(maxRam ?? ns.getPurchasedServerMaxRam(), ns.getPurchasedServerMaxRam());
  let ram = minRam;
  while (ram < maxRam && ns.getPurchasedServerCost(ram * 2) <= maxCost) {
    ram *= 2;
  }
  if (ram <= maxRam && ns.getPurchasedServerCost(ram) <= maxCost) {
    return ram;
  }
  return 0;
}

export function getMaxUpgradableRam(ns: NS, host: string, maxCost: number, maxRam?: number): number {
  maxRam = Math.min(maxRam ?? ns.getPurchasedServerMaxRam(), ns.getPurchasedServerMaxRam());
  let ram = ns.getServerMaxRam(host);
  while (ram < maxRam && ns.getPurchasedServerUpgradeCost(host, ram * 2) <= maxCost) {
    ram *= 2;
  }
  if (ram <= maxRam && ns.getPurchasedServerUpgradeCost(host, ram) <= maxCost) {
    return ram;
  }
  return 0;
}