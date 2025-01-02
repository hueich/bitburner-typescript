import { NS } from "@ns";
import { parseHostname, parseThreads } from 'flags';
import { copyScriptsFromHome, getFreeRam } from 'utils';

const hackScript = 'sleep-hack.ts';
const growScript = 'sleep-grow.ts';
const weakenScript = 'sleep-weaken.ts';

const depScripts = [
  'flags.ts',
]

const hostScripts = [
  hackScript,
  growScript,
  weakenScript,
].concat(depScripts);

const timeGap = 100;
const securityPerWeaken = 0.05;

export async function main(ns: NS) {
  const data = ns.flags([
    // Hostname of target server.
    ['target', ''],
    // Hostname of host server running the scripts.
    ['host', ''],
  ]);
  const target = parseHostname(data.target);
  const host = parseHostname(data.host) || ns.getHostname();

  // Copy scripts to use.
  copyScriptsFromHome(ns, host, hostScripts);

  await prepServer(ns, target, host);

  while (true) {
    await doHWGW(ns, target, host);
  }
}

// Weaken.
async function minimizeSecurity(ns: NS, target: string, host: string) {
  const minSec = ns.getServerMinSecurityLevel(target);
  while (ns.getServerSecurityLevel(target) > minSec) {
    const weakenTime = ns.getWeakenTime(target);
    const hostFreeRam = getFreeRam(ns, host);
    const threads = Math.max(Math.floor(hostFreeRam / ns.getScriptRam(weakenScript, host)), 1);
    ns.exec(weakenScript, host, { threads: threads }, '--target', target, '--threads', threads);
    await ns.sleep(weakenTime + timeGap);
  }
}

// Grow, weaken.
async function maximizeMoney(ns: NS, target: string, host: string) {
  const maxMoney = ns.getServerMaxMoney(target);
  while (ns.getServerMoneyAvailable(target) < maxMoney) {
    const baseGrowTime = ns.getGrowTime(target);
    const baseWeakenTime = ns.getWeakenTime(target);
    const maxTime = Math.max(
      baseGrowTime + timeGap,
      baseWeakenTime
    );

    const growTimeDelay = maxTime - baseGrowTime - timeGap;
    const weakenTimeDelay = maxTime - baseWeakenTime;

    ns.print('Timing:');
    ns.printf('  maxTime=%f', maxTime);
    ns.printf('  growTimeDelay=%f', growTimeDelay);
    ns.printf('  weakenTimeDelay=%f', weakenTimeDelay);

    const curMoney = ns.getServerMoneyAvailable(target);
    const baseGrowThreads = ns.growthAnalyze(target, maxMoney / curMoney);
    const baseSecInc = ns.growthAnalyzeSecurity(baseGrowThreads, target);
    const baseWeakenThreads = baseSecInc / securityPerWeaken;

    ns.print('Base threads:');
    ns.printf('  baseGrowThreads=%f', baseGrowThreads);
    ns.printf('  baseWeakenThreads=%f', baseWeakenThreads);

    const hostFreeRam = getFreeRam(ns, host);
    const baseRamCost = getHWGWNeededRam(ns, 0, baseGrowThreads, 0, baseWeakenThreads, host);
    const threadsScale = Math.min(hostFreeRam / baseRamCost, 1.0);

    let realGrowThreads = Math.max(Math.floor(baseGrowThreads * threadsScale), 1);
    let realWeakenThreads = Math.max(Math.ceil(baseWeakenThreads * threadsScale), 1);

    ns.print('Original real thread counts:');
    ns.printf('  realGrowThreads=%f', realGrowThreads);
    ns.printf('  realWeakenThreads=%f', realWeakenThreads);

    // Ensure security stays minimum.
    while (ns.growthAnalyzeSecurity(realGrowThreads, target) > realWeakenThreads * securityPerWeaken) {
      realGrowThreads -= 1;
    }

    // Ensure scripts fit in ram.
    while (getHWGWNeededRam(ns, 0, realGrowThreads, 0, realWeakenThreads, host) > hostFreeRam) {
      realGrowThreads -= 1;
    }

    ns.print('Final real thread counts:');
    ns.printf('  realGrowThreads=%f', realGrowThreads);
    ns.printf('  realWeakenThreads=%f', realWeakenThreads);

    ns.exec(growScript, host, { threads: realGrowThreads }, '--target', target, '--sleepMs', growTimeDelay, '--threads', realGrowThreads);
    ns.exec(weakenScript, host, { threads: realWeakenThreads }, '--target', target, '--sleepMs', weakenTimeDelay, '--threads', realWeakenThreads);
    await ns.sleep(maxTime + timeGap);
  }
}

async function prepServer(ns: NS, target: string, host: string) {
  // Prepare server for hacking.
  await minimizeSecurity(ns, target, host);
  await maximizeMoney(ns, target, host);
}

// Hack, weaken, grow, weaken.
async function doHWGW(ns: NS, target: string, host: string) {
  const baseHackTime = ns.getHackTime(target);
  const baseGrowTime = ns.getGrowTime(target);
  const baseWeakenTime = ns.getWeakenTime(target);
  const maxTime = Math.max(
    baseHackTime + (timeGap * 3),
    baseGrowTime + timeGap,
    baseWeakenTime + (timeGap * 2)
  );

  const hackTimeDelay = maxTime - baseHackTime - (timeGap * 3);
  const hackWeakenTimeDelay = maxTime - baseWeakenTime - (timeGap * 2);
  const growTimeDelay = maxTime - baseGrowTime - timeGap;
  const growWeakenTimeDelay = maxTime - baseWeakenTime;

  ns.print('Timing:');
  ns.printf('  maxTime=%f', maxTime);
  ns.printf('  hackTimeDelay=%f', hackTimeDelay);
  ns.printf('  hackWeakenTimeDelay=%f', hackWeakenTimeDelay);
  ns.printf('  growTimeDelay=%f', growTimeDelay);
  ns.printf('  growWeakenTimeDelay=%f', growWeakenTimeDelay);

  const baseHackThreads = 100;
  const maxMoney = ns.getServerMaxMoney(target);
  const curMoney = ns.getServerMoneyAvailable(target);
  const hackMoneyRatio = ns.hackAnalyze(target);
  const hackMoneyAmount = curMoney * hackMoneyRatio;
  const hackMoneyAmountTotal = Math.min(hackMoneyAmount * baseHackThreads, maxMoney);

  const hackSecurityIncrease = ns.hackAnalyzeSecurity(baseHackThreads, target);
  const baseHackWeakenThreads = hackSecurityIncrease / securityPerWeaken;

  const moneyRemaining = Math.max(curMoney - hackMoneyAmountTotal, 0);

  let baseGrowThreads = getGrowThreads(ns, target, moneyRemaining, hackMoneyAmountTotal, 1);
  let lastGrowThreads = 0;
  while (Math.abs(baseGrowThreads - lastGrowThreads) > 0.01) {
    lastGrowThreads = baseGrowThreads;
    baseGrowThreads = getGrowThreads(ns, target, moneyRemaining, hackMoneyAmountTotal, baseGrowThreads);
  }

  const growthSecurityIncrease = ns.growthAnalyzeSecurity(baseGrowThreads);
  const baseGrowWeakenThreads = growthSecurityIncrease / securityPerWeaken;

  ns.printf('baseGrowThreads=%f', baseGrowThreads);
  ns.printf('growthSecurityIncrease=%f', growthSecurityIncrease);
  ns.printf('baseGrowWeakenThreads=%f', baseGrowWeakenThreads);

  // Calculate actual thread counts.
  const hostFreeRam = getFreeRam(ns, host);
  const baseRamCost = getHWGWNeededRam(ns, baseHackThreads, baseGrowThreads, baseHackWeakenThreads, baseGrowWeakenThreads, host);
  const threadsScale = hostFreeRam / baseRamCost;

  ns.printf('hostFreeRam=%f', hostFreeRam);
  ns.printf('baseRamCost=%f', baseRamCost);
  ns.printf('threadsScale=%f', threadsScale);

  ns.print('Base threads:');
  ns.printf('  baseHackThreads=%f', baseHackThreads);
  ns.printf('  baseHackWeakenThreads=%f', baseHackWeakenThreads);
  ns.printf('  baseGrowThreads=%f', baseGrowThreads);
  ns.printf('  baseGrowWeakenThreads=%f', baseGrowWeakenThreads);

  let realHackThreads = Math.floor(baseHackThreads * threadsScale);
  let realHackWeakenThreads = Math.ceil(baseHackWeakenThreads * threadsScale);
  let realGrowThreads = Math.ceil(baseGrowThreads * threadsScale);
  let realGrowWeakenThreads = Math.ceil(baseGrowWeakenThreads * threadsScale);

  ns.print('Original real thread counts:');
  ns.printf('  realHackThreads=%f', realHackThreads);
  ns.printf('  realHackWeakenThreads=%f', realHackWeakenThreads);
  ns.printf('  realGrowThreads=%f', realGrowThreads);
  ns.printf('  realGrowWeakenThreads=%f', realGrowWeakenThreads);

  // Make sure target state breaks even.
  let realHackMoney = Math.min(curMoney * hackMoneyRatio * realHackThreads, maxMoney);
  let realMoneyRemaining = Math.max(curMoney - realHackMoney, 0);
  let neededGrowThreads = getGrowThreads(ns, target, realMoneyRemaining, realHackMoney, realGrowThreads);
  while (neededGrowThreads > realGrowThreads) {
    realHackThreads -= 1;
    realHackMoney = Math.min(curMoney * hackMoneyRatio * realHackThreads, maxMoney);
    realMoneyRemaining = Math.max(curMoney - realHackMoney, 0);
    neededGrowThreads = getGrowThreads(ns, target, realMoneyRemaining, realHackMoney, realGrowThreads);
  }

  let realHackSecurity = ns.hackAnalyzeSecurity(realHackThreads, target);
  let realHackWeakenSecurity = ns.weakenAnalyze(realHackWeakenThreads);
  if (realHackSecurity > realHackWeakenSecurity) {
    realHackThreads -= 1;
  }

  let realGrowSecurity = ns.growthAnalyzeSecurity(realGrowThreads);
  let realGrowWeakenSecurity = ns.weakenAnalyze(realGrowWeakenThreads);
  if (realGrowSecurity > realGrowWeakenSecurity) {
    realGrowWeakenThreads += 1;
  }

  let neededRam = getHWGWNeededRam(ns, realHackThreads, realGrowThreads, realHackWeakenThreads, realGrowWeakenThreads, host);
  while (neededRam > hostFreeRam) {
    realHackThreads -= 1;
    neededRam = getHWGWNeededRam(ns, realHackThreads, realGrowThreads, realHackWeakenThreads, realGrowWeakenThreads, host);
  }

  // Schedule threads.
  // TODO: Check pid to make ensure running.
  ns.print('Final real thread counts:');
  ns.printf('  realHackThreads=%f', realHackThreads);
  ns.printf('  realHackWeakenThreads=%f', realHackWeakenThreads);
  ns.printf('  realGrowThreads=%f', realGrowThreads);
  ns.printf('  realGrowWeakenThreads=%f', realGrowWeakenThreads);
  ns.exec(hackScript, host, { threads: realHackThreads }, '--target', target, '--sleepMs', hackTimeDelay, '--threads', realHackThreads);
  ns.exec(weakenScript, host, { threads: realHackWeakenThreads }, '--target', target, '--sleepMs', hackWeakenTimeDelay, '--threads', realHackWeakenThreads);
  ns.exec(growScript, host, { threads: realGrowThreads }, '--target', target, '--sleepMs', growTimeDelay, '--threads', realGrowThreads);
  ns.exec(weakenScript, host, { threads: realGrowWeakenThreads }, '--target', target, '--sleepMs', growWeakenTimeDelay, '--threads', realGrowWeakenThreads);
  await ns.sleep(maxTime + timeGap);
}

function getGrowThreads(ns: NS, target: string, moneyBase: number, moneyDelta: number, threads: number = 1): number {
  const growthMultiplier = (moneyDelta + moneyBase + threads) / (moneyBase + threads);
  if (growthMultiplier < 1) {
    ns.print('getGrowThreads:');
    ns.printf('  target: %s', target);
    ns.printf('  growthMultiplier: %f', growthMultiplier);
    ns.printf('  moneyBase: %f', moneyBase);
    ns.printf('  moneyDelta: %f', moneyDelta);
    ns.printf('  threads: %f', threads);
  }
  return ns.growthAnalyze(target, growthMultiplier);
}

function getHWGWNeededRam(ns: NS, hackThreads: number, growThreads: number, hackWeakenThreads: number, growWeakenThreads: number, host: string): number {
  return (
    ns.getScriptRam(hackScript, host) * hackThreads +
    ns.getScriptRam(growScript, host) * growThreads +
    ns.getScriptRam(weakenScript, host) * (hackWeakenThreads + growWeakenThreads)
  );
}