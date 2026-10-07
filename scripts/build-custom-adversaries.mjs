#!/usr/bin/env node
// Adversaries that are NOT in ATT&CK yet (recent, vendor-reported campaigns). Same data shape as build-attack-data.mjs output,
// ids are X#### (game-local), every claim is cited to public reporting, and nothing here is an ATT&CK-authoritative statement:
// technique mappings below are the ones the cited vendors state. IPs, domains and hashes are deliberately not recorded (they rot).
//   node scripts/build-custom-adversaries.mjs        (run after build-attack-data.mjs; idempotent)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(readFileSync(path.join(root, 'data/attack/techniques.json'), 'utf8'));
const S = {
  trend: { name: 'Trend Micro — Analyzing TeamPCP’s supply chain attacks', url: 'https://www.trendmicro.com/en_us/research/26/e/analyzing-teampcp-supply-chain-attacks.html', desc: 'Trend Micro Research, 2026. Campaign timeline, credential-theft mechanics and ATT&CK mapping.' },
  sophos: { name: 'Sophos — Vect and TeamPCP partner for ransomware campaigns', url: 'https://www.sophos.com/en-us/blog/vect-and-teampcp-partner-for-ransomware-campaigns', desc: 'Sophos, 2026. Partnership between TeamPCP and the Vect ransomware operation.' },
  csa: { name: 'CSA — TeamPCP: CI/CD security tool supply chain compromise', url: 'https://labs.cloudsecurityalliance.org/research/csa-research-note-teampcp-cicd-supply-chain-20260325-csa-sty/', desc: 'Cloud Security Alliance research note, 25 March 2026. Trivy compromise mechanism, payloads and mitigations.' }
};
const X = [{
  id: 'X0001', kind: 'group', name: 'TeamPCP', aliases: ['PCPcat'], first: '2025-12', last: '2026-05', domains: ['enterprise'], url: S.trend.url,
  summary: 'TeamPCP is a financially motivated group that first drew attention in December 2025 for mass exploitation of the React2Shell vulnerability (CVE-2025-55182) and of exposed Docker, Kubernetes and Redis services. In March 2026 it turned to cascading software supply chain attacks on developer and security tooling: a poisoned Trivy release and GitHub Action (19 March), Checkmarx KICS (23 March), LiteLLM on PyPI (24 March) and Telnyx (27 March), followed by Bitwarden CLI and elementary-data in April. Credentials stolen from each victim were used to compromise the next, and were then monetised through a partnership with the Vect ransomware operation and data-extortion partners. Reporting on this group is vendor-sourced and still developing.',
  summaryCites: [S.trend, S.sophos, S.csa].map(({ name, url }) => ({ name, url })),
  techs: [
    ['T1195.002', 'Poisoned Trivy, KICS, LiteLLM and Telnyx releases; worm-like propagation across npm packages', 3],
    ['T1528', 'Stolen GitHub personal access tokens and npm tokens used to push malicious code and publish packages', 3],
    ['T1078', 'Valid service-account tokens and stolen credentials used for access to repositories and cloud accounts', 3],
    ['T1199', 'Abused trust in security tooling and third-party Actions that run with high privilege in CI', 2],
    ['T1059.006', 'Python payloads delivered through package installs, including .pth files executed at interpreter start-up', 2],
    ['T1059.004', 'Unix shell stages in CI runners', 1],
    ['T1059.007', 'JavaScript payloads run through the Bun runtime and npm lifecycle hooks', 2],
    ['T1547', 'Python .pth import mechanism used for persistence on developer and CI hosts', 2],
    ['T1552.001', 'Harvested secrets from files: SSH keys, cloud credentials, Kubernetes tokens, AI/MCP configuration', 3],
    ['T1552.005', 'Queried cloud instance metadata for credentials', 2],
    ['T1003.007', 'Scraped runner process memory through the proc filesystem for secrets', 2],
    ['T1526', 'Enumerated cloud services and called secret-manager APIs to extend theft beyond files', 2],
    ['T1102.001', 'Dead-drop resolution through public repositories and commit search to recover C2', 2],
    ['T1071.001', 'Exfiltration over HTTPS to actor infrastructure with a custom header', 2],
    ['T1567.001', 'Exfiltration to hidden public repositories created in the victim’s own GitHub account', 2]
  ].map(([id, text, ev]) => ({ id, text, ev })),
  software: [], goal: 'exfil',
  observables: [
    { kind: 'file', value: 'litellm_init.pth', tech: 'T1547' }, { kind: 'file', value: '*.pth > 100 KB in site-packages', tech: 'T1547' },
    { kind: 'api', value: 'secretsmanager:ListSecrets / GetSecretValue from a CI role', tech: 'T1526' }, { kind: 'pattern', value: 'public repo named tpcp-docs-<timestamp> in a victim account', tech: 'T1567.001' },
    { kind: 'command', value: 'Bun runtime appearing on a Python or Go build host', tech: 'T1059.007' }, { kind: 'pattern', value: 'force-pushed version tags on a GitHub Action (76 of 77 tags moved)', tech: 'T1195.002' }
  ],
  sources: Object.values(S)
}];
const idxPath = path.join(root, 'data/adversaries/index.json');
let idx = JSON.parse(readFileSync(idxPath, 'utf8')).filter(a => !a.id.startsWith('X'));
for (const x of X) {
  const techs = x.techs.map(({ id, ev }) => { const t = T[id]; if (!t) throw new Error('unknown technique ' + id); return { id, n: t.n, tac: t.tac, m: t.m || [], d: ev >= 3 ? 2 : 1, ev }; });
  writeFileSync(path.join(root, 'data/adversaries', x.id + '.json'), JSON.stringify({ id: x.id, kind: x.kind, name: x.name, aliases: x.aliases, url: x.url, domains: x.domains, first: x.first, last: x.last, custom: true, techs, software: x.software }) + '\n');
  writeFileSync(path.join(root, 'data/dossiers', x.id + '.json'), JSON.stringify({ id: x.id, name: x.name, aliases: x.aliases, url: x.url, custom: true, summary: x.summary, summaryCites: x.summaryCites, procedures: x.techs.map(t => ({ id: t.id, text: t.text, cites: x.summaryCites })), observables: x.observables, sources: x.sources, softwareLinks: [] }) + '\n');
  idx.push({ id: x.id, name: x.name, kind: x.kind, techs: techs.length, sw: 0, obs: x.observables.length, sources: x.sources.length });
  console.log(x.id, x.name, techs.length, 'techniques');
}
writeFileSync(idxPath, JSON.stringify(idx) + '\n');
