import { readFileSync } from 'node:fs';
// Control strength for the AWS service cards comes from CTID Mappings Explorer (AWS security capabilities -> ATT&CK, scored
// minimal/partial/significant per technique and protect/detect/respond). The game folds `respond` into `protect` for ward purposes.
const AWS = JSON.parse(readFileSync(new URL('../../data/ctid/aws.json', import.meta.url), 'utf8')).capabilities;
const TECH = JSON.parse(readFileSync(new URL('../../data/attack/techniques.json', import.meta.url), 'utf8'));
const cov = (...ids) => {
  const out = { protect: {}, detect: {} };
  for (const id of ids) for (const [t, s] of Object.entries(AWS[id]?.t || {})) {
    if (!TECH[t] || TECH[t].dom === 'ics') continue;
    for (const [cat, sc] of Object.entries(s)) { if (!sc) continue; const k = cat === 'detect' ? 'detect' : 'protect'; out[k][t] = Math.max(out[k][t] || 0, sc); }
  }
  if (!Object.keys(out.protect).length) delete out.protect; if (!Object.keys(out.detect).length) delete out.detect;
  return out;
};
const nCov = c => Object.keys(c.protect || {}).length + Object.keys(c.detect || {}).length;
const svc = (id, name, type, fn, prop, extra, desc, lesson, ...capIds) => {
  const c = cov(...capIds);
  return { id: 'cloud.' + id, name, type, fn, prop, cost: 2, rarity: 'uncommon', target: type === 'augment' ? 'control' : 'asset', ...extra, cov: c,
    desc: `${desc} CTID-scored coverage: ${Object.keys(c.protect || {}).length} techniques protected, ${Object.keys(c.detect || {}).length} detected.`,
    lesson: `${lesson} Strength comes from CTID Mappings Explorer’s scoring of ${AWS[capIds[0]].n} against ATT&CK (AWS, 12 Dec 2024); scores are the Center’s, the game turns them into ward and detection bonuses.`,
    refs: ['ctid:aws', 'cloud:shared-responsibility', ...(extra.refs || [])] };
};

export const base = {
  schema: 2, id: 'cloud', kind: 'scenario', name: 'Cloud (AWS)',
  tagline: 'IAM is the new perimeter. Everything is an API call.',
  icon: 'cloud',
  theme: { accent: '#ff9900', accent2: '#4cc9f0', bg: ['#0b1220', '#101c30', '#162640'] },
  org: {
    name: 'Skyline Ledger', sector: 'Financial data & analytics (SaaS on AWS)',
    brief: 'A 250-person analytics company running in a multi-account AWS organisation: a public web app, Lambda and EKS workloads, an S3 data lake with customer financial data, and engineers who sign in through SSO. A rushed migration left some wildcard IAM policies, one CloudTrail gap, and a few long-lived access keys in CI.',
    crownJewels: ['Customer data lake (S3)', 'AWS Organization management account'],
    regimes: [
      { name: 'Shared responsibility model', note: 'AWS secures the cloud; you secure what you put in it. Most breaches are customer-side identity, configuration and data-handling failures, not AWS failures.', refs: ['cloud:shared-responsibility'] },
      { name: 'Privacy Act 1988 (Cth) — Notifiable Data Breaches', note: 'Eligible data breaches must be assessed within 30 days and notified to the OAIC and affected individuals when serious harm is likely.', refs: ['privacy:ndb'] },
      { name: 'ASD ISM, IRAP and Essential Eight', note: 'Government and regulated customers will ask for IRAP assessment against the ISM; Essential Eight is the baseline mitigation set (MFA, restricting admin privileges, backups).', refs: ['ism:overview', 'e8:maturity-model'] }
    ]
  },
  assets: [
    { id: 'web', name: 'Public App (CloudFront/ALB)', kind: 'app', zone: 'Edge', hp: 8, jewel: false, exposed: true, icon: 'globe', desc: 'The customer-facing web application and its CDN.', adjacent: ['api', 'idp'] },
    { id: 'dev', name: 'Engineer Laptops', kind: 'endpoint', zone: 'Corporate', hp: 8, jewel: false, exposed: true, icon: 'laptop', desc: 'Developer machines with CLI profiles and cached SSO sessions.', adjacent: ['idp', 'k8s'] },
    { id: 'saas', name: 'Third-party SaaS & Integrations', kind: 'vendor', zone: 'Third parties', hp: 6, jewel: false, exposed: true, icon: 'plug', desc: 'Monitoring, support and CI vendors with cross-account roles.', adjacent: ['api', 'idp'] },
    { id: 'api', name: 'API & Lambda Functions', kind: 'app', zone: 'Workloads', hp: 8, jewel: false, exposed: false, icon: 'code-xml', desc: 'The serverless back end behind the public app.', adjacent: ['web', 'saas', 'k8s', 'lake'] },
    { id: 'idp', name: 'IAM Identity Center & Roles', kind: 'identity', zone: 'Identity', hp: 8, jewel: false, exposed: false, icon: 'id-card', desc: 'SSO, permission sets and role trust relationships.', adjacent: ['web', 'dev', 'saas', 'org'] },
    { id: 'k8s', name: 'EKS Cluster', kind: 'server', zone: 'Workloads', hp: 8, jewel: false, exposed: false, icon: 'container', desc: 'Container workloads, node roles and cluster secrets.', adjacent: ['dev', 'api', 'lake', 'log'] },
    { id: 'lake', name: 'Customer Data Lake (S3)', kind: 'data', zone: 'Data', hp: 10, jewel: true, exposed: false, icon: 'database', desc: 'Customers’ financial datasets, curated tables and ML features.', adjacent: ['api', 'k8s', 'log'] },
    { id: 'org', name: 'Org Management Account', kind: 'cloud', zone: 'Governance', hp: 12, jewel: true, exposed: false, icon: 'castle', desc: 'AWS Organizations root: SCPs, billing and the ability to create or close accounts.', adjacent: ['idp', 'log'] },
    { id: 'log', name: 'Log Archive & Security Tooling', kind: 'server', zone: 'Governance', hp: 6, jewel: false, exposed: false, icon: 'scroll-text', desc: 'CloudTrail, Config and GuardDuty findings aggregated in a security account.', adjacent: ['k8s', 'lake', 'org'] }
  ],
  roster: { acts: [
    { name: 'Act I — Cryptominers and Exposed Keys', battle: ['G0139', 'G0106', 'G1043', 'G1032'], elite: ['G1004'], boss: 'G1057', tiers: { battle: 1, elite: 2, boss: 2 } },
    { name: 'Act II — Identity-led Intrusions', battle: ['G1015', 'C0059', 'G0049'], elite: ['X0001'], boss: 'G0016', tiers: { battle: 2, elite: 3, boss: 3 } },
    { name: 'Act III — Persistent in the Cloud', battle: ['G0096', 'G0007', 'G0032'], elite: ['C0057'], boss: 'C0024', tiers: { battle: 2, elite: 3, boss: 3 } }
  ] },
  reading: [
    { title: 'CTID Mappings Explorer — AWS security capabilities to ATT&CK', url: 'https://ctid.mitre.org/mappings/external/aws/' },
    { title: 'AWS — Shared responsibility model', url: 'https://aws.amazon.com/compliance/shared-responsibility-model/' },
    { title: 'AWS Security Reference Architecture', url: 'https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/welcome.html' },
    { title: 'MITRE ATT&CK Cloud Matrix (IaaS)', url: 'https://attack.mitre.org/matrices/enterprise/cloud/iaas/' },
    { title: 'ASD ISM — Guidelines for using cloud services', url: 'https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/ism' }
  ]
};

export const overrides = {
  'govern.spoofing': { name: 'Cloud Access & Landing Zone Policy', flavour: 'Every account, role and key has an owner', desc: 'Policy for how accounts are created, who may assume which role, how long sessions last and when access keys are forbidden, enforced through the landing zone and SCPs.', refs: ['cloud:shared-responsibility', 'nist-csf:GV.PO-01', 'ism:overview'] },
  'govern.dos': { name: 'Resilience & Region Strategy', flavour: 'What happens when a region has a bad day?', desc: 'Defined recovery objectives per workload, multi-AZ and multi-region choices matched to them, and the board’s acceptance of what is not covered.', refs: ['cloud:shared-responsibility', 'nist-csf:GV.OC-04', 'apra:cps230'] },
  'identify.disclosure': { name: 'Data Discovery & Classification', flavour: 'Which bucket holds the customer ledgers?', desc: 'Continuous discovery and classification of data stores so sensitive buckets, tables and snapshots are known, owned and protected proportionally.', refs: ['nist-csf:ID.AM-07', 'owasp:cheatsheets', 'privacy:ndb'] },
  'identify.tampering': { name: 'Asset & IAM Inventory', flavour: 'Know every role that can assume every other', desc: 'An inventory of accounts, roles, trust policies, access keys and internet-exposed resources, with who can reach what, so privilege paths are found by you first.', refs: ['nist-csf:ID.AM-01', 'cloud:shared-responsibility', 'attack:T1078.004'] },
  'protect.spoofing': { name: 'Phishing-resistant SSO MFA', flavour: 'Passkeys for everyone, keys for no one', desc: 'FIDO2 passkeys on SSO, no long-lived IAM user keys, and session lifetimes short enough that a stolen cookie expires before it is useful.', refs: ['attack:M1032', 'nist:800-63', 'e8:mfa', 'nist-csf:PR.AA-03'] },
  'protect.tampering': { name: 'Guardrails & Config Drift Control', flavour: 'Infrastructure as code, or it did not happen', desc: 'SCPs, AWS Config rules and infrastructure-as-code pipelines that block or revert out-of-policy changes.', refs: ['attack:M1022', 'nist-800-53:CM-2', 'nist-csf:PR.PS-01'] },
  'protect.elevation': { name: 'Least-privilege IAM', flavour: 'Wildcards are where breaches live', desc: 'Roles scoped to specific actions and resources, permission boundaries, no iam:PassRole sprawl, and access analyser findings treated as defects.', refs: ['attack:M1026', 'nist-800-53:AC-6', 'e8:restrict-admin'] },
  'detect.tampering': { name: 'Cloud Threat Detection', flavour: 'CloudTrail is a confession, if someone reads it', desc: 'Behavioural detection over CloudTrail, VPC flow and DNS logs for anomalous API calls, credential use from new locations and logging being disabled.', refs: ['nist-csf:DE.CM-01', 'attack:M1047', 'ctid:aws'] },
  'respond.elevation': { name: 'Quarantine & Credential Revocation', flavour: 'Deny-all SCP, then ask questions', desc: 'Runbooks to attach a deny-all policy, revoke sessions, rotate keys and snapshot affected instances for forensics within minutes.', refs: ['nist:800-61', 'nist-csf:RS.MI-02', 'attack:T1078.004'] },
  'respond.disclosure': { name: 'Breach Assessment & Notification', flavour: '30 days to assess; start the clock on day one', desc: 'A rehearsed process for deciding whether an incident is an eligible data breach, drafting OAIC and customer notifications, and meeting contractual clocks.', refs: ['privacy:ndb', 'nist-csf:RS.CO-02', 'nist:800-61'] },
  'recover.dos': { name: 'Cross-account Immutable Backups', flavour: 'A backup in the same account is a hostage', desc: 'Backups copied to a separate, locked-down account with object lock, plus a rehearsed rebuild of workloads from infrastructure as code.', refs: ['e8:backups', 'attack:M1053', 'nist-csf:RC.RP-03'] }
};

export const cards = [
  svc('guardduty', 'Amazon GuardDuty', 'control', 'detect', 'tampering', { detect: { str: 3, n: 1, scope: 'asset' }, refs: ['nist-csf:DE.CM-01'] }, 'Managed threat detection on this asset: reveals one foothold per round (stealth ≤ 3).', 'GuardDuty watches CloudTrail, VPC flow and DNS for known-bad behaviours. It sees credential misuse, odd API calls and crypto-mining, but only what its analytics cover.', 'amazon_guardduty'),
  svc('securityhub', 'AWS Security Hub', 'control', 'detect', 'repudiation', { detect: { str: 2, n: 2, scope: 'global' }, refs: ['nist-csf:DE.AE-02'] }, 'Aggregated findings across accounts: reveals up to two footholds anywhere each round (stealth ≤ 2).', 'Security Hub centralises findings and checks posture. Its value is correlation across accounts; it is weaker on novel behaviour.', 'aws_security_hub'),
  svc('waf', 'AWS WAF', 'control', 'protect', 'elevation', { ward: { E: 1 }, refs: ['owasp-top10:A03'] }, '+1 Authorisation ward at the edge.', 'A web application firewall blocks classes of known request patterns. It is a compensating control for vulnerable code, not a replacement for fixing it.', 'aws_web_application_firewall'),
  svc('vpc', 'VPC Security Groups & NACLs', 'control', 'protect', 'elevation', { ward: { E: 1 }, flags: ['segment'], refs: ['nist-800-53:SC-7'] }, '+1 Authorisation ward. Spread into or out of this asset costs +1 and has −1 power.', 'Network segmentation in the cloud is software-defined and easy to get wrong. Tight security groups turn lateral movement from a stroll into a series of denied connections.', 'amazon_virtual_private_cloud'),
  svc('iam', 'AWS IAM (least privilege)', 'control', 'protect', 'spoofing', { ward: { S: 2 }, refs: ['nist-800-53:AC-6', 'attack:M1026'] }, '+2 Authentication ward.', 'IAM policies are the real perimeter. Scoped roles, conditions and short sessions limit what a stolen credential can do.', 'aws_identity_and_access_management'),
  svc('config', 'AWS Config Rules', 'control', 'protect', 'tampering', { ward: { T: 1 }, refs: ['nist-800-53:CM-2'] }, '+1 Integrity ward. Out-of-policy changes are detected and reverted.', 'Config records and evaluates resource configuration over time. It catches the open bucket and the permissive security group, which is where many cloud breaches start.', 'aws_config'),
  svc('netfw', 'AWS Network Firewall', 'control', 'protect', 'disclosure', { ward: { I: 1 }, refs: ['attack:M1037'] }, '+1 Confidentiality ward. Egress filtering stops exfiltration to unapproved hosts.', 'Stolen data has to leave. Domain and protocol filtering at the VPC boundary converts quiet exfiltration into blocked connections and alerts.', 'aws_network_firewall'),
  svc('shield', 'AWS Shield Advanced', 'control', 'protect', 'dos', { ward: { D: 2 }, refs: ['attack:M1037'] }, '+2 Availability ward.', 'Managed DDoS protection absorbs volumetric and protocol attacks upstream, where capacity is cheap.', 'aws_shield'),
  svc('secrets', 'AWS Secrets Manager', 'augment', 'protect', 'spoofing', { base: ['protect.spoofing', 'protect.disclosure'], rarity: 'common', cost: 1, aug: { ward: { S: 1 }, cov: cov('aws_secrets_manager') }, refs: ['attack:T1552'] }, 'Credentials are fetched at runtime and rotated automatically. Counters credentials in files and repos.', 'Static secrets in code and config are the loot every stealer is built to find. Runtime retrieval with rotation shrinks the window a stolen value works.', 'aws_secrets_manager'),
  { id: 'cloud.breakglass', name: 'Quarantine SCP (Break-glass)', type: 'action', fn: 'respond', prop: 'elevation', cost: 1, rarity: 'uncommon', consume: 'battle', target: 'asset', fx: [{ op: 'unprivilegeAll' }, { op: 'clearCreds' }, { op: 'shield', n: 2 }], desc: 'Attach a deny-all policy and revoke sessions: all footholds lose privilege, stolen credentials are stripped, +2 ward this round. Exhausts.', lesson: 'A deny-all SCP and session revocation stop an identity-led intrusion within minutes, at the price of breaking legitimate work. Pre-approve who may pull the lever and what is excluded.', refs: ['nist:800-61', 'cloud:shared-responsibility', 'attack:T1078.004'] }
];
for (const c of cards) if (c.type === 'augment') { c.desc = c.desc.replace(/ CTID-scored.*$/, '') + ` CTID-scored coverage: ${nCov(c.aug.cov)} techniques.`; delete c.cov; }
export const relics = [
  { id: 'cloud.well-architected', name: 'Well-Architected Review', icon: 'clipboard-check', rarity: 'uncommon', hooks: { passive: { maxResilience: 6 }, battleStart: [{ op: 'wardRandomAsset', n: 1 }] }, desc: '+6 max Resilience. At the start of each battle one random asset gains +1 permanent ward.', lesson: 'A structured review against the security pillar finds the wildcard role and the missing log before an attacker does.', refs: ['cloud:shared-responsibility', 'owasp:samm'] }
];

export const systems = [
  {
    id: 'identity-accounts', name: 'Identity, accounts & guardrails',
    blurb: 'Engineers sign in via SSO and assume roles in the production account. A pipeline exchanges an OIDC token for role credentials. The management account applies guardrails, and every API call is logged to an archive.',
    elements: [
      { id: 'eng', type: 'external', label: 'Engineers', x: 110, y: 280 },
      { id: 'ci', type: 'external', label: 'CI/CD pipeline', x: 110, y: 450 },
      { id: 'sso', type: 'process', label: 'Identity Center & roles', x: 320, y: 280 },
      { id: 'mgmt', type: 'process', label: 'Organization & SCPs', x: 530, y: 110 },
      { id: 'prod', type: 'process', label: 'Production account', x: 530, y: 280 },
      { id: 'logs', type: 'store', label: 'CloudTrail log archive', x: 530, y: 450 },
      { id: 'keys', type: 'store', label: 'KMS keys & secrets', x: 740, y: 450 }
    ],
    flows: [
      { id: 'f1', from: 'eng', to: 'sso', label: 'SSO sign-in' },
      { id: 'f2', from: 'ci', to: 'sso', label: 'OIDC token exchange' },
      { id: 'f3', from: 'sso', to: 'prod', label: 'Assumed-role sessions' },
      { id: 'f4', from: 'mgmt', to: 'prod', label: 'Guardrail policies' },
      { id: 'f5', from: 'prod', to: 'logs', label: 'API audit events' },
      { id: 'f6', from: 'prod', to: 'keys', label: 'Decrypt & secret reads' }
    ],
    boundaries: [
      { id: 'b1', label: 'People & pipelines', x: 10, y: 180, w: 200, h: 370 },
      { id: 'b2', label: 'AWS organisation', x: 235, y: 50, w: 620, h: 470 }
    ],
    scenarios: [
      { id: 'cl1', target: { kind: 'element', id: 'eng' }, text: 'An engineer clicks a lookalike SSO page. An adversary-in-the-middle proxy captures the session cookie and replays it from another country.', answer: 'S', why: 'The attacker is accepted as the engineer. No resource has been changed yet; the failure is authentication, solved by phishing-resistant factors and short sessions.', refs: ['attack:T1557', 'attack:T1539', 'nist:800-63'] },
      { id: 'cl2', target: { kind: 'flow', id: 'f4' }, text: 'A change to a service control policy is intercepted and edited so the deny on disabling logging disappears before it is applied.', answer: 'T', why: 'The content of a trusted instruction is changed in transit. Integrity of the guardrail flow failed, not secrecy or availability.', refs: ['attack:T1685.002', 'attack:M1022', 'nist-800-53:CM-3'] },
      { id: 'cl3', target: { kind: 'element', id: 'logs' }, text: 'Production admins can stop a trail and delete its logs, and log file validation is off, so after an incident nobody can prove which API calls were made.', answer: 'R', why: 'There is no tamper-evident record, so actions can be denied and cannot be proved. That is the defining Repudiation problem.', refs: ['attack:T1685.002', 'attack:T1070', 'nist-800-53:AU-9'] },
      { id: 'cl4', target: { kind: 'element', id: 'keys' }, text: 'A secret’s resource policy allows any principal in the account to read it, so a compromised low-privilege function retrieves database credentials.', answer: 'I', why: 'Sensitive stored secrets are readable by something that should not hold them. Nothing is altered; the failure is confidentiality.', refs: ['attack:T1552.005', 'attack:T1555', 'nist-800-53:AC-6'] },
      { id: 'cl5', target: { kind: 'element', id: 'prod' }, text: 'A developer role has iam:PassRole and permission to create functions, so it creates a function running as an administrator role and invokes it.', answer: 'E', why: 'A role gains rights it was never granted through a permitted action chain. The developer is not impersonating anyone; the privilege boundary failed.', refs: ['attack:T1098.003', 'attack:T1078.004', 'nist-800-53:AC-6'] },
      { id: 'cl6', target: { kind: 'flow', id: 'f5' }, text: 'During an intrusion an attacker generates enormous volumes of API calls, so audit events are delayed or dropped and the defenders are blind for an hour.', answer: 'D', why: 'The flow of audit evidence is made unavailable when it is needed. Nothing is forged or read.', refs: ['attack:T1499', 'attack:M1047', 'nist-csf:DE.CM-01'] },
      { id: 'cl7', target: { kind: 'flow', id: 'f6' }, text: 'An application logs the plaintext secret value it just fetched, and the log is readable by every engineer and a third-party monitoring vendor.', answer: 'I', why: 'The contents of the flow end up readable by people who should not see them. Nothing is changed and the service works.', refs: ['attack:T1552.001', 'owasp-top10:A09', 'nist-800-53:AU-3'] },
      { id: 'cl8', target: { kind: 'element', id: 'mgmt' }, text: 'An administrator applies a deny-all SCP to the production OU by mistake and every workload, pipeline and engineer is locked out for two hours.', answer: 'D', why: 'The service becomes unavailable to everyone who needs it, through error rather than attack. Availability, not secrecy or integrity, is what fails.', refs: ['nist-csf:PR.IR-03', 'apra:cps230', 'nist-800-53:CM-3'] }
    ]
  },
  {
    id: 'data-lake', name: 'Data lake & analytics',
    blurb: 'Source systems feed an ETL layer that writes curated data to an S3 lake. Analysts query through a portal; a catalogue controls access, partners receive shared data and models train on the lake.',
    elements: [
      { id: 'src', type: 'external', label: 'Source systems', x: 110, y: 110 },
      { id: 'analyst', type: 'external', label: 'Analysts', x: 110, y: 450 },
      { id: 'etl', type: 'process', label: 'ETL jobs', x: 320, y: 110 },
      { id: 'portal', type: 'process', label: 'Analytics portal', x: 320, y: 450 },
      { id: 'cat', type: 'store', label: 'Catalogue & grants', x: 530, y: 110 },
      { id: 'lake', type: 'store', label: 'S3 data lake', x: 530, y: 280 },
      { id: 'ml', type: 'process', label: 'ML training', x: 530, y: 450 },
      { id: 'share', type: 'external', label: 'Partner data sharing', x: 740, y: 280 }
    ],
    flows: [
      { id: 'f1', from: 'src', to: 'etl', label: 'Batch & stream ingest' },
      { id: 'f2', from: 'etl', to: 'lake', label: 'Curated writes' },
      { id: 'f3', from: 'analyst', to: 'portal', label: 'Queries' },
      { id: 'f4', from: 'portal', to: 'lake', label: 'Query execution' },
      { id: 'f5', from: 'lake', to: 'share', label: 'Partner shares' },
      { id: 'f6', from: 'cat', to: 'lake', label: 'Access policy' },
      { id: 'f7', from: 'lake', to: 'ml', label: 'Training data' }
    ],
    boundaries: [
      { id: 'b1', label: 'Sources & users', x: 10, y: 20, w: 200, h: 520 },
      { id: 'b2', label: 'Data platform', x: 235, y: 50, w: 405, h: 470 }
    ],
    scenarios: [
      { id: 'dl1', target: { kind: 'element', id: 'analyst' }, text: 'An analyst’s access key is committed to a public repository and used from a rented server to run queries as that analyst.', answer: 'S', why: 'The attacker is accepted as a legitimate analyst. The platform did nothing wrong by its own rules; the credential did.', refs: ['attack:T1552.001', 'attack:T1078.004', 'attack:M1027'] },
      { id: 'dl2', target: { kind: 'flow', id: 'f1' }, text: 'An attacker with write access to a source feed injects crafted records that skew the features used for credit-risk models downstream.', answer: 'T', why: 'The content entering the platform is manipulated, and later decisions will trust it. This is integrity of the flow, not confidentiality or availability.', refs: ['attack:T1565.002', 'owasp-llm:LLM04', 'nist-800-53:SI-7'] },
      { id: 'dl3', target: { kind: 'element', id: 'lake' }, text: 'A bucket policy added during a migration allows list and read to any principal, and a scanner finds the customer datasets within a day.', answer: 'I', why: 'Sensitive stored data is readable by the public. Nothing is altered and the service is up, so the failure is confidentiality.', refs: ['attack:T1530', 'owasp-top10:A05', 'privacy:ndb'] },
      { id: 'dl4', target: { kind: 'element', id: 'portal' }, text: 'A crafted query bypasses the portal’s row-level filter, so an analyst for one customer reads every customer’s rows.', answer: 'E', why: 'A caller gains more authority than it was granted. This is an authorisation failure rather than impersonation or interception.', refs: ['owasp-api:API1', 'owasp-top10:A01', 'nist-800-53:AC-3'] },
      { id: 'dl5', target: { kind: 'element', id: 'cat' }, text: 'An insider edits the catalogue’s grants table so that an external account has read access to a sensitive dataset.', answer: 'T', why: 'Stored policy that controls later decisions is changed without authority. This is tampering with the store.', refs: ['attack:T1098', 'attack:T1565.001', 'nist-800-53:AC-5'] },
      { id: 'dl6', target: { kind: 'flow', id: 'f5' }, text: 'A flood of requests against the partner sharing endpoint exhausts its limits, so contractually required nightly data deliveries fail.', answer: 'D', why: 'The channel is made unavailable to legitimate partners. Nothing is forged, altered or read.', refs: ['attack:T1499', 'owasp-api:API4', 'apra:cps230'] },
      { id: 'dl7', target: { kind: 'element', id: 'etl' }, text: 'All ETL jobs run under a single shared role, so when a dataset is corrupted nobody can tell which job or person did it.', answer: 'R', why: 'There is no attributable evidence of which actor performed an action. That is the defining Repudiation problem.', refs: ['nist-800-53:AU-10', 'nist-800-53:AU-3', 'nist-csf:PR.AA-01'] },
      { id: 'dl8', target: { kind: 'flow', id: 'f4' }, text: 'A browser extension used by analysts captures query results as they are returned to the portal, including customer account numbers.', answer: 'I', why: 'The contents of the flow are captured by something that should not see them. Altering or blocking results would be a different threat.', refs: ['attack:T1185', 'owasp-top10:A02', 'attack:M1054'] }
    ]
  }
];

export const ttx = [
  {
    id: 'cloud-mfa-fatigue', name: 'Push Fatigue to the Data Lake', blurb: 'An extortion crew buys credentials, fatigues an engineer into approving MFA, and walks from SSO to the data lake in an afternoon. Modelled on the documented LAPSUS$ playbook (MITRE G1004) and public Attack Flow analyses of identity-led cloud breaches.',
    adversary: { id: 'G1004', tier: 2 }, rounds: 8, maxScore: 250,
    injects: [
      { id: 'i1', round: 1, at: 'T+00:00', kind: 'alert', title: 'Fifteen MFA prompts at 2 a.m.', text: 'An engineer’s phone buzzes with a stream of MFA push requests. The engineer approves one to make it stop, then messages the IT help desk the next morning.', fx: [],
        decision: { prompt: 'What does the help desk do?', choices: [
          { id: 'a', quality: 'best', label: 'Treat it as account compromise: revoke the engineer’s sessions and tokens, reset credentials, check sign-in logs for the approved prompt’s location and device, and move to number-matching or passkeys.', fx: [{ op: 'reveal', n: 1 }, { op: 'shieldAll', n: 1 }], lesson: 'An approved push after a barrage is the signature of MFA fatigue. Revoke first, then investigate; plain push approvals are the weakness to retire.', refs: ['attack:T1621', 'attack:M1032', 'nist:800-63'] },
          { id: 'b', quality: 'ok', label: 'Tell the engineer to be more careful and carry on.', fx: [], lesson: 'Training does not undo an approved prompt. The attacker already has a session.', refs: ['nist-csf:PR.AT-01'] },
          { id: 'c', quality: 'poor', label: 'Close the ticket: the prompts stopped.', fx: [{ op: 'plant' }, { op: 'resilience', n: -3 }], lesson: 'The prompts stopped because the attacker succeeded.', refs: ['attack:T1621'] }
        ] } },
      { id: 'i2', round: 2, at: 'T+05:00', kind: 'ops', title: 'A new session, a new device', text: 'Identity logs show the engineer’s account signing in from a residential proxy and registering a second MFA device. The account can assume a broad “PowerUser” role.', fx: [{ op: 'intel', n: 1 }],
        decision: { prompt: 'What contains it without losing the evidence?', choices: [
          { id: 'a', quality: 'best', label: 'Revoke all sessions for the user, remove the rogue device, attach a deny policy to the roles that user can assume, snapshot CloudTrail and keep the accounts running for forensics.', fx: [{ op: 'reveal', n: 2 }, { op: 'shieldAll', n: 1 }], lesson: 'Cut the identity’s reach and keep the evidence. Roles are what a session can do; policy on the role is faster than hunting each session.', refs: ['nist:800-61', 'attack:T1078.004', 'attack:T1098'] },
          { id: 'b', quality: 'ok', label: 'Disable the user only.', fx: [{ op: 'intel', n: 1 }], lesson: 'Existing role sessions may live for hours after the user is disabled.', refs: ['nist-800-53:AC-2'] },
          { id: 'c', quality: 'poor', label: 'Delete the user and their CloudTrail history to start clean.', fx: [{ op: 'plant' }, { op: 'resilience', n: -4 }], lesson: 'You have just destroyed the only record of what the attacker did.', refs: ['attack:T1070'] }
        ] } },
      { id: 'i3', round: 4, at: 'T+10:00', kind: 'alert', title: 'The data lake is listing itself', text: 'GuardDuty reports unusual S3 data-plane activity: a role assumed from an unfamiliar location is listing and downloading large volumes from the customer data lake.', fx: [{ op: 'intel', n: 1 }],
        decision: { prompt: 'What is your next move?', choices: [
          { id: 'a', quality: 'best', label: 'Block the role and source with a deny policy, enable bucket-level logging and Block Public Access checks, quantify what left via data-event logs, and invoke the incident process including legal.', fx: [{ op: 'shieldExfil', n: 3 }, { op: 'reveal', n: 2 }], lesson: 'Stop the egress, then measure it. Data-event logs tell you what was read and by whom, which determines the notification decision.', refs: ['attack:T1530', 'attack:T1537', 'nist-csf:RS.AN-03'] },
          { id: 'b', quality: 'ok', label: 'Watch for a few more minutes to confirm it is malicious.', fx: [], lesson: 'Every minute of observation is more customer data gone.', refs: ['nist-csf:RS.MA-01'] },
          { id: 'c', quality: 'poor', label: 'Move the data to another bucket to protect it.', fx: [{ op: 'plant' }, { op: 'resilience', n: -3 }], lesson: 'Copying the data while the credential is live feeds the attacker.', refs: ['nist:800-61'] }
        ] } },
      { id: 'i4', round: 6, at: 'T+16:00', kind: 'comms', title: 'An extortion message', text: 'A message arrives from the group: it holds customer datasets and will publish them unless paid. It includes a sample with real account numbers.', fx: [],
        decision: { prompt: 'How do you respond?', choices: [
          { id: 'a', quality: 'best', label: 'Engage the incident response retainer and counsel, preserve the message, do not pay or negotiate yourself, and begin the Notifiable Data Breaches assessment and customer notifications.', fx: [{ op: 'score', n: 2 }, { op: 'resilience', n: 2 }], lesson: 'Payment does not remove notification duties and funds the next victim. Counsel and the retainer carry the negotiation question; assessment starts now.', refs: ['privacy:ndb', 'nist:800-61', 'nist-csf:RS.CO-02'] },
          { id: 'b', quality: 'ok', label: 'Ask the CEO to decide whether to pay.', fx: [], lesson: 'A leadership decision is needed, but without counsel and evidence it is a guess.', refs: ['nist-csf:GV.RR-01'] },
          { id: 'c', quality: 'poor', label: 'Ignore the message.', fx: [{ op: 'resilience', n: -3 }], lesson: 'The sample proves access; ignoring it leaves customers to learn from the leak site.', refs: ['privacy:ndb'] }
        ] } },
      { id: 'i5', round: 7, at: 'T+22:00', kind: 'regulator', title: 'Customers ask what happened', text: 'A major bank customer’s security team asks for a written incident summary within 24 hours under your contract.', fx: [],
        decision: { prompt: 'What do you send?', choices: [
          { id: 'a', quality: 'best', label: 'A factual summary: what is known, what data sets were involved, containment actions, what is still unknown and when you will update, reviewed by counsel.', fx: [{ op: 'score', n: 1 }, { op: 'resilience', n: 3 }], lesson: 'Customers can forgive an incident they hear about quickly and accurately. They do not forgive spin.', refs: ['nist-csf:RS.CO-03', 'privacy:ndb'] },
          { id: 'b', quality: 'poor', label: 'Say no customer data was affected.', fx: [{ op: 'resilience', n: -4 }], lesson: 'An unverified denial contradicted by a leak site ends the relationship.', refs: ['nist:800-61'] },
          { id: 'c', quality: 'ok', label: 'Wait until the investigation is finished.', fx: [], lesson: 'Contract clocks do not wait for forensics; send what you know with caveats.', refs: ['nist-csf:RS.CO-03'] }
        ] } }
    ],
    objectives: [
      { id: 'o1', kind: 'detectBy', round: 3, text: 'Detect the intrusion by round 3 (T+8h)', points: 30 },
      { id: 'o2', kind: 'keepJewel', text: 'Keep the data lake and the org management account safe', points: 40 },
      { id: 'o3', kind: 'decisions', n: 3, text: 'Make at least 3 best-practice decisions', points: 30 },
      { id: 'o4', kind: 'resilienceAbove', n: 20, text: 'Finish with Resilience above 20', points: 20 },
      { id: 'o5', kind: 'win', text: 'Contain the operation', points: 20 }
    ]
  }
];
