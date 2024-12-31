import { NS } from "@ns";

export async function main(ns: NS) {
  const defaultTarget = '';
  const defaultThreads = 1;
  const defaultLoop = false;
  const defaultMoneyThreshRatio = 0.95;

  const data = ns.flags([
    ['target', defaultTarget],
    ['threads', defaultThreads],
    ['loop', defaultLoop],
    ['money_thresh_ratio', defaultMoneyThreshRatio],
  ]);

  const target = data.target.toString() !== '' ? data.target.toString() : ns.getHostname();
  const maxThreads = typeof data.threads === 'number' ? Math.floor(Math.max(data.threads, 1)) : defaultThreads;
  const isLoop = typeof data.loop === 'boolean' ? data.loop : defaultLoop;
  let moneyThreshRatio = (typeof data.money_thresh_ratio === 'number' && 0.0 < data.money_thresh_ratio && data.money_thresh_ratio <= 1.0) ? data.money_thresh_ratio : defaultMoneyThreshRatio;

  if (target === 'home') {
    return;
  }

  if (!isLoop) {
    const nonLoopOnlyFuncs = ['spawn', 'getScriptRam', 'getScriptName', 'getServerMaxRam'];
    const ramWhenLoop = ns.getScriptRam(ns.getScriptName()) - nonLoopOnlyFuncs.map(
      function (value: string): number {
        return ns.getFunctionRamCost(value);
      }).reduce(function (prev, cur): number { return prev + cur; });
    ns.printf('ramWhenLoop = %s', ns.formatRam(ramWhenLoop));
    const numThreads = Math.floor(ns.getServerMaxRam(ns.getHostname()) / ramWhenLoop);
    ns.spawn(ns.getScriptName(), { ramOverride: ramWhenLoop, threads: numThreads, spawnDelay: 100 }, '--target', target, '--threads', numThreads, '--loop', '--money_thresh_ratio', moneyThreshRatio);
    return;
  }

  ns.printf('Begin hacking server "%s"...', target);
  const maxMoney = ns.getServerMaxMoney(target);
  const minSec = ns.getServerMinSecurityLevel(target);
  const secPerWeaken = 0.05;

  ns.printf('Server "%s" max money: %f', target, maxMoney);
  ns.printf('Server "%s" min security: %f', target, minSec);

  if (maxMoney <= 0) {
    ns.print('No money to be made here.');
    return;
  }

  ns.printf('Initial money threshold ratio: %f', moneyThreshRatio);
  let moneyDelta = 0;

  while (true) {
    let secDiff = ns.getServerSecurityLevel(target) - minSec;
    ns.printf('Security difference: %.3f', secDiff)
    const secThresh = secPerWeaken * maxThreads;
    if (secDiff >= secThresh) {
      let numThreads = Math.min(Math.ceil(secDiff / secPerWeaken), maxThreads);
      await ns.weaken(target, { threads: numThreads });
      continue;
    }

    let oldMoney = ns.getServerMoneyAvailable(target);
    let moneyDiffPercent = oldMoney / maxMoney;
    ns.printf('Money difference percent: %s', ns.formatPercent(moneyDiffPercent, 3));
    if (moneyDelta <= 0 && moneyDiffPercent < moneyThreshRatio) {
      let numThreads = maxThreads;
      await ns.grow(target, { threads: numThreads });
      let newMoney = ns.getServerMoneyAvailable(target);
      ns.printf('Grew $%f', newMoney - oldMoney);
      if (newMoney === maxMoney) {
        moneyThreshRatio -= 0.01;
        ns.printf('Updated moneyThreshRatio to %s', ns.formatPercent(moneyThreshRatio));
      }
      moneyDelta += newMoney - oldMoney;
      continue;
    }

    oldMoney = ns.getServerMoneyAvailable(target);
    let numThreads = maxThreads;
    await ns.hack(target, { threads: numThreads });
    let newMoney = ns.getServerMoneyAvailable(target);
    moneyDelta = newMoney - oldMoney;
  }
}