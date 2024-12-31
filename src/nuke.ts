import { NS } from "@ns";

// Nuke a server. Returns true if has root access.
export function nuke(ns: NS, host: string): boolean {
  if (!ns.serverExists(host)) {
    ns.printf('Server "%s" does not exist', host);
    return false;
  }

  ns.printf('Nuking server "%s"...', host);

  if (ns.hasRootAccess(host)) {
    ns.print('Already has root access');
    return true;
  }

  if (ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()) {
    ns.print('Server hacking level too high');
    return false;
  }

  let remainingPorts = ns.getServerNumPortsRequired(host);
  if (remainingPorts > 0 && ns.fileExists('brutessh.exe')) {
    ns.brutessh(host);
    remainingPorts--;
  }
  if (remainingPorts > 0 && ns.fileExists('ftpcrack.exe')) {
    ns.ftpcrack(host);
    remainingPorts--;
  }
  if (remainingPorts > 0 && ns.fileExists('relaysmtp.exe')) {
    ns.relaysmtp(host);
    remainingPorts--;
  }
  if (remainingPorts > 0 && ns.fileExists('httpworm.exe')) {
    ns.httpworm(host);
    remainingPorts--;
  }
  if (remainingPorts > 0 && ns.fileExists('sqlinject.exe')) {
    ns.sqlinject(host);
    remainingPorts--;
  }
  if (remainingPorts > 0) {
    ns.printf("Failed to nuke server, ports remaining: %d", remainingPorts);
    return false;
  }
  ns.nuke(host);
  return ns.hasRootAccess(host);
}