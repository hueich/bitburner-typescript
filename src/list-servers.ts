import { NS } from "@ns";
import { listServers } from 'algos';

const listFilename = 'server-infos.txt';

export async function main(ns: NS) {
  let servers = listServers(ns);
  servers.sort(function (a, b) {
    // Sort by descending growth.
    return (b.serverGrowth || 0) - (a.serverGrowth || 0);
  });

  let isHeader = true;
  for (const server of servers) {
    const fields: { name: string, value: string | boolean | number }[] = [
      { name: 'Host', value: server.hostname },
      { name: 'Rooted', value: server.hasAdminRights },
      { name: 'Growth', value: server.serverGrowth || 0 },
      { name: 'MaxMoney', value: server.moneyMax || 0 },
      { name: 'MinSecurity', value: server.minDifficulty || 0 },
      { name: 'BaseSecurity', value: server.baseDifficulty || 0 },
      { name: 'MinHackSkill', value: server.requiredHackingSkill || 0 },
      { name: 'MaxRam', value: server.maxRam },
    ];
    if (isHeader) {
      const header = fields.map(function (field): string { return field.name; }).join(',').concat('\n');
      ns.write(listFilename, header, 'w');
      isHeader = false;
    }

    const formats = fields.map(function (field): string {
      return typeof field.value === 'number' ? '%f' : '%s';
    }).join(',').concat('\n');
    const values = fields.map(function (field) { return field.value; });
    ns.write(listFilename, ns.sprintf(formats, ...values), 'a');
  }
}