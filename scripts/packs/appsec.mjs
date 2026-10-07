export const base = {
  schema: 2, id: 'appsec', kind: 'scenario', name: 'AppSec & Supply Chain',
  tagline: 'Pipelines, packages, secrets and LLMs. Your build system is a production system.',
  icon: 'code-xml',
  theme: { accent: '#b074ff', accent2: '#ff5fb0', bg: ['#0f0a1c', '#1a1030', '#2a1240'] },
  org: {
    name: 'Paperplane Labs', sector: 'Software & AI platform (SaaS)',
    brief: 'A 120-person software company with an API product and an LLM-powered assistant that answers questions over customer documents. Everything ships through GitHub Actions to a cloud account. The pipeline pulls open-source packages and third-party Actions by mutable tag, CI jobs hold long-lived cloud and registry tokens, and the security scanner runs with the same privileges as the build.',
    crownJewels: ['Production cloud account & secrets', 'Customer documents & vector store'],
    regimes: [
      { name: 'Privacy Act 1988 (Cth) — Notifiable Data Breaches scheme', note: 'Eligible data breaches likely to cause serious harm must be assessed within 30 days and notified to the OAIC and affected individuals.', refs: ['privacy:ndb'] },
      { name: 'NIST SSDF (SP 800-218) & CISA Secure by Design', note: 'Not legally mandatory for most private companies, but increasingly a contractual requirement from enterprise and government customers.', refs: ['nist:800-218', 'cisa:overview'] },
      { name: 'OWASP ASVS, Top 10, API Top 10 and LLM Top 10', note: 'Good-practice baselines for application and AI security. They set the vocabulary customers and auditors will use.', refs: ['owasp:asvs', 'owasp-top10:A08', 'owasp-llm:LLM01'] }
    ]
  },
  assets: [
    { id: 'web', name: 'Public API & Web App', kind: 'app', zone: 'Internet-facing', hp: 8, jewel: false, exposed: true, icon: 'globe', desc: 'The product’s API gateway and web front end.', adjacent: ['llm', 'idp'] },
    { id: 'dev', name: 'Developer Workstations', kind: 'endpoint', zone: 'Engineering', hp: 8, jewel: false, exposed: true, icon: 'laptop', desc: 'Laptops with source, SSH keys, cloud CLIs and AI assistants configured with tokens.', adjacent: ['idp', 'scm', 'oss'] },
    { id: 'oss', name: 'Open-source Packages & Actions', kind: 'vendor', zone: 'Third parties', hp: 6, jewel: false, exposed: true, icon: 'package', desc: 'npm, PyPI, container images and third-party GitHub Actions the build trusts by mutable tag.', adjacent: ['scm', 'dev'] },
    { id: 'idp', name: 'SSO & Identity Provider', kind: 'identity', zone: 'Engineering', hp: 8, jewel: false, exposed: false, icon: 'id-card', desc: 'Single sign-on for staff, GitHub and cloud.', adjacent: ['web', 'dev', 'scm', 'prod'] },
    { id: 'scm', name: 'Source Control & CI/CD', kind: 'app', zone: 'Engineering', hp: 8, jewel: false, exposed: false, icon: 'git-branch', desc: 'Repositories, workflows and the runners that hold deploy tokens.', adjacent: ['dev', 'oss', 'idp', 'reg', 'prod'] },
    { id: 'reg', name: 'Artefact Registry', kind: 'server', zone: 'Engineering', hp: 6, jewel: false, exposed: false, icon: 'boxes', desc: 'Built images and packages that production deploys.', adjacent: ['scm', 'prod'] },
    { id: 'llm', name: 'LLM Gateway & RAG Service', kind: 'app', zone: 'Production', hp: 8, jewel: false, exposed: false, icon: 'brain', desc: 'Prompt assembly, retrieval, tool calls and the model provider connection.', adjacent: ['web', 'cust', 'prod'] },
    { id: 'prod', name: 'Production Cloud & Secrets', kind: 'cloud', zone: 'Production', hp: 12, jewel: true, exposed: false, icon: 'cloud', desc: 'The production cloud account, secrets manager and Kubernetes clusters.', adjacent: ['idp', 'scm', 'reg', 'llm', 'cust'] },
    { id: 'cust', name: 'Customer Documents & Vectors', kind: 'data', zone: 'Production', hp: 10, jewel: true, exposed: false, icon: 'database', desc: 'Customer files, embeddings and the vector index built from them.', adjacent: ['llm', 'prod'] }
  ],
  roster: { acts: [
    { name: 'Act I — Commodity Attackers', battle: ['G1057', 'G1004', 'G0139', 'G1043'], elite: ['G1015'], boss: 'C0058', tiers: { battle: 1, elite: 2, boss: 2 } },
    { name: 'Act II — Targeted Intrusions', battle: ['G0125', 'G0114', 'C0059'], elite: ['G0096'], boss: 'X0001', tiers: { battle: 2, elite: 2, boss: 3 } },
    { name: 'Act III — Supply Chain Operators', battle: ['G0016', 'G0032', 'C0057'], elite: ['G0007'], boss: 'C0024', tiers: { battle: 2, elite: 3, boss: 3 } }
  ] },
  reading: [
    { title: 'Trend Micro — Analyzing TeamPCP’s supply chain attacks', url: 'https://www.trendmicro.com/en_us/research/26/e/analyzing-teampcp-supply-chain-attacks.html' },
    { title: 'CSA — TeamPCP: CI/CD security tool supply chain compromise', url: 'https://labs.cloudsecurityalliance.org/research/csa-research-note-teampcp-cicd-supply-chain-20260325-csa-sty/' },
    { title: 'NIST SP 800-218 — Secure Software Development Framework', url: 'https://csrc.nist.gov/pubs/sp/800/218/final' },
    { title: 'SLSA — Supply-chain Levels for Software Artifacts', url: 'https://slsa.dev/' },
    { title: 'OWASP Top 10 for LLM Applications', url: 'https://genai.owasp.org/llm-top-10/' },
    { title: 'GitHub — Security hardening for GitHub Actions', url: 'https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions' }
  ]
};

export const overrides = {
  'govern.spoofing': { name: 'Secure Development Policy', flavour: 'Who may publish, approve and deploy', desc: 'Policy for who can merge, publish packages and deploy: branch protection, required reviews, signed commits for release branches and a documented owner for every pipeline credential.', refs: ['nist:800-218', 'owasp:samm', 'nist-csf:GV.PO-01'] },
  'govern.tampering': { name: 'Dependency & Third-party Action Policy', flavour: 'Nothing enters the build unreviewed', desc: 'Rules for adding dependencies and Actions: pin to immutable digests or commit SHAs, review upgrades, and block unmaintained or single-maintainer packages from release paths.', refs: ['nist:800-218', 'nist-csf:GV.SC-04', 'attack:T1195'] },
  'identify.tampering': { name: 'SBOM & Pipeline Inventory', flavour: 'Know every package and every workflow', desc: 'A software bill of materials per release and an inventory of workflows, runners, tokens and the third-party Actions they call, so “are we affected?” takes minutes, not days.', refs: ['nist:800-218', 'owasp:cheatsheets', 'nist-csf:ID.AM-02'] },
  'identify.disclosure': { name: 'Secrets & Data-Flow Map', flavour: 'Which job can read which secret', desc: 'A map of every secret, which pipelines and runners can read it, and where customer data flows into the LLM path, so the blast radius of one compromised job is known in advance.', refs: ['owasp:threat-dragon', 'nist-csf:ID.AM-03', 'owasp-llm:LLM02'] },
  'protect.spoofing': { name: 'Short-lived Credentials (OIDC)', flavour: 'Tokens that expire before anyone can steal them', desc: 'Workload identity federation for CI: jobs exchange a signed identity for minutes-long cloud credentials, with no long-lived keys in secrets stores or environment variables.', refs: ['nist-800-53:IA-5', 'nist:800-218', 'attack:M1032', 'cloud:shared-responsibility'] },
  'protect.tampering': { name: 'Pinned, Verified Dependencies', flavour: 'Digest or it did not happen', desc: 'Lockfiles with integrity hashes, GitHub Actions pinned to full commit SHAs, container images referenced by digest, and provenance verified before use.', refs: ['attack:T1195.002', 'nist:800-218', 'attack:M1013', 'owasp-top10:A08'] },
  'protect.elevation': { name: 'Least-privilege Pipelines', flavour: 'A scanner should not hold deploy keys', desc: 'CI jobs get only the permissions they need: read-only tokens by default, separate release identities, ephemeral runners, and no secrets on pull-request workflows from forks.', refs: ['attack:M1026', 'nist-800-53:AC-6', 'owasp:devsecops'] },
  'detect.tampering': { name: 'CI/CD Telemetry & Anomaly Detection', flavour: 'Watch the build like production', desc: 'Detections on workflow changes, tag rewrites, unexpected egress from runners, new repositories in the org and secret-manager calls from CI roles at odd hours.', refs: ['nist-csf:DE.CM-01', 'attack:T1526', 'attack:M1047'] },
  'respond.spoofing': { name: 'Rotate From a Clean Host', flavour: 'Assume every secret the job could see is gone', desc: 'Playbook to revoke and reissue every credential reachable from an affected pipeline, from a trusted workstation, before the attacker uses them.', refs: ['nist:800-61', 'nist-csf:RS.MI-02', 'nist-800-53:IR-4'] },
  'respond.tampering': { name: 'Freeze & Revert Releases', flavour: 'Stop the line, roll back to known good', desc: 'Ability to freeze deployments, yank a bad package version and redeploy the last verified artefact, with customers told which versions to avoid.', refs: ['nist:800-218', 'nist-csf:RS.MI-01', 'owasp:devsecops'] },
  'recover.dos': { name: 'Rebuild From Clean Source', flavour: 'Reproducible builds beat forensics at 3 a.m.', desc: 'Rebuild runners, images and registries from clean, signed sources with reproducible builds, then verify outputs against known hashes before redeploying.', refs: ['nist:800-218', 'e8:backups', 'nist-csf:RC.RP-03'] }
};

export const cards = [
  { id: 'appsec.sha-pin', name: 'Pin Actions to Commit SHAs', type: 'augment', fn: 'protect', prop: 'tampering', cost: 1, rarity: 'uncommon', target: 'control', base: ['protect.tampering'], aug: { ward: { T: 1 }, mit: ['M1013'], expert: [{ tech: 'T1195.002', ref: 'nist:800-218' }] }, desc: 'Third-party Actions and images are referenced by immutable digest. Counters poisoned releases and rewritten tags.', lesson: 'A mutable version tag is a pointer the maintainer, or whoever steals their token, can move. In the 2026 Trivy compromise 76 of 77 tags were force-pushed to malicious commits; pipelines pinned to a commit SHA did not move.', refs: ['attack:T1195.002', 'nist:800-218', 'owasp:devsecops'] },
  { id: 'appsec.oidc', name: 'OIDC Workload Identity', type: 'augment', fn: 'protect', prop: 'spoofing', cost: 1, rarity: 'rare', target: 'control', base: ['protect.spoofing', 'protect.elevation'], aug: { ward: { S: 1, E: 1 }, expert: [{ tech: 'T1528', ref: 'nist-800-53:IA-5' }, { tech: 'T1552.001', ref: 'nist:800-218' }] }, desc: 'CI jobs authenticate with a signed identity and receive minutes-long credentials. Counters token theft and secrets in files.', lesson: 'A stealer on a runner can only take what exists. Long-lived PATs and cloud keys are the loot; short-lived federated credentials turn it into a ten-minute problem.', refs: ['attack:T1528', 'attack:T1552.001', 'nist-800-53:IA-5', 'cloud:shared-responsibility'] },
  { id: 'appsec.egress', name: 'Runner Egress Allow-list', type: 'control', fn: 'protect', prop: 'disclosure', cost: 2, rarity: 'uncommon', target: 'asset', ward: { I: 2, D: 1 }, mit: ['M1037', 'M1031'], desc: 'Build runners can only reach approved hosts. +2 Confidentiality ward, +1 Availability ward.', lesson: 'Stolen secrets must leave to be useful. A runner that can only talk to the registry and the cloud API turns an in-job stealer into a failed job and an alert.', refs: ['attack:M1037', 'attack:T1071.001', 'nist-800-53:SC-7'] },
  { id: 'appsec.secret-hunt', name: 'Secret Scanning & CI Log Review', type: 'action', fn: 'detect', prop: 'disclosure', cost: 1, rarity: 'common', fx: [{ op: 'reveal', n: 2, str: 5 }, { op: 'intel', n: 1 }], desc: 'Scan repos, logs and artefacts for leaked tokens and unexpected network calls: reveal up to 2 footholds (stealth ≤ 5), +1 intel.', lesson: 'Secrets leak into logs, caches and commit history. Scanning finds the credential before an attacker does, and finding one in the wrong place tells you which pipeline to look at.', refs: ['owasp:cheatsheets', 'attack:T1552.001', 'nist-csf:DE.CM-09'] },
  { id: 'appsec.freeze', name: 'Release Freeze & Yank', type: 'action', fn: 'respond', prop: 'tampering', cost: 1, rarity: 'uncommon', target: 'asset', fx: [{ op: 'isolate' }, { op: 'unprivilege' }, { op: 'shield', n: 1 }], desc: 'Stop deployments, yank the suspect version and drop privileges on the asset for a round.', lesson: 'The first move after a supply chain alert is to stop new bad code propagating, not to find out how it got there.', refs: ['nist:800-218', 'nist:800-61', 'attack:M1051'] }
];
export const relics = [
  { id: 'appsec.sbom-gate', name: 'SBOM & Provenance Gate', icon: 'package-check', rarity: 'uncommon', hooks: { passive: { maxResilience: 5 }, battleStart: [{ op: 'intel', n: 2 }] }, desc: '+5 max Resilience. Start each battle with +2 intel.', lesson: 'When a package is reported poisoned, an SBOM turns “are we affected?” from a week into minutes.', refs: ['nist:800-218', 'owasp:samm'] }
];

export const systems = [
  {
    id: 'cicd-pipeline', name: 'CI/CD pipeline',
    blurb: 'Developers push code, workflows build it on runners that fetch open-source packages and third-party Actions, and publish artefacts that production deploys.',
    elements: [
      { id: 'oss', type: 'external', label: 'Open-source & Actions', x: 110, y: 110 },
      { id: 'dev', type: 'external', label: 'Developers', x: 110, y: 450 },
      { id: 'scm', type: 'process', label: 'Source control', x: 320, y: 110 },
      { id: 'ci', type: 'process', label: 'CI runner', x: 320, y: 450 },
      { id: 'reg', type: 'store', label: 'Artefact registry', x: 530, y: 110 },
      { id: 'sec', type: 'store', label: 'Secrets & tokens', x: 530, y: 450 },
      { id: 'prod', type: 'process', label: 'Production cloud', x: 740, y: 280 }
    ],
    flows: [
      { id: 'f1', from: 'oss', to: 'ci', label: 'Package & Action fetch' },
      { id: 'f2', from: 'dev', to: 'scm', label: 'Commits & pull requests' },
      { id: 'f3', from: 'scm', to: 'ci', label: 'Workflow triggers' },
      { id: 'f4', from: 'ci', to: 'reg', label: 'Publish artefacts' },
      { id: 'f5', from: 'sec', to: 'ci', label: 'Secrets at job start' },
      { id: 'f6', from: 'reg', to: 'prod', label: 'Deployments' }
    ],
    boundaries: [
      { id: 'b1', label: 'Outside the organisation', x: 10, y: 20, w: 200, h: 520 },
      { id: 'b2', label: 'Engineering & CI', x: 235, y: 50, w: 405, h: 470 },
      { id: 'b3', label: 'Production', x: 655, y: 200, w: 200, h: 160 }
    ],
    scenarios: [
      { id: 'ap1', target: { kind: 'element', id: 'oss' }, text: 'A popular package’s maintainer is phished and their publishing token is used to push a new version that looks like a routine release.', answer: 'S', why: 'The attacker is accepted as the legitimate maintainer. Nothing in your estate has been altered yet; the failure is trust in a third party’s identity.', refs: ['attack:T1195.002', 'attack:T1078', 'nist-csf:GV.SC-04'] },
      { id: 'ap2', target: { kind: 'flow', id: 'f1' }, text: 'A third-party Action is referenced by version tag. The maintainer’s compromised account force-pushes the tag to a malicious commit, and the next workflow run fetches it unchanged to your runner.', answer: 'T', why: 'The content you retrieve is not what you reviewed. Integrity of the flow failed, even though the connection was authentic and encrypted.', refs: ['attack:T1195.002', 'nist:800-218', 'owasp-top10:A08'] },
      { id: 'ap3', target: { kind: 'element', id: 'sec' }, text: 'A malicious step on the runner scrapes process memory and environment variables, collecting cloud keys, registry tokens and SSH keys for later use.', answer: 'I', why: 'Secrets are read by someone who should not hold them. Nothing is modified or taken down, which is why it is quiet and dangerous.', refs: ['attack:T1552.001', 'attack:T1003.007', 'nist-800-53:SC-28'] },
      { id: 'ap4', target: { kind: 'element', id: 'ci' }, text: 'A workflow triggered by pull requests from forks runs with a write token, so an outside contributor’s code gains the rights of a maintainer.', answer: 'E', why: 'Untrusted code obtains privileges it was never meant to have. The contributor is not impersonating anyone; the privilege boundary of the job failed.', refs: ['owasp-top10:A04', 'nist-800-53:AC-6', 'owasp:devsecops'] },
      { id: 'ap5', target: { kind: 'element', id: 'reg' }, text: 'Using a stolen publishing token, an attacker overwrites an existing version in the registry so that production deploys a poisoned image under a trusted name.', answer: 'T', why: 'Stored artefacts that production will trust are altered without authority. Confidentiality and availability are not the failure; integrity is.', refs: ['attack:T1195.002', 'attack:M1013', 'nist:800-218'] },
      { id: 'ap6', target: { kind: 'flow', id: 'f4' }, text: 'An attacker floods the publish endpoint with bogus uploads, exhausting rate limits so legitimate release builds fail for a day.', answer: 'D', why: 'The channel is made unavailable to legitimate use. Nothing is forged, altered or read.', refs: ['attack:T1499', 'owasp-api:API4', 'attack:M1037'] },
      { id: 'ap7', target: { kind: 'element', id: 'dev' }, text: 'Everyone merges using a shared release bot account. After a malicious change ships, nobody can show who approved it.', answer: 'R', why: 'The shared identity leaves no attributable evidence, so people can deny the action. The fix is individual identities and signed, logged approvals.', refs: ['nist-800-53:AU-10', 'nist-csf:PR.AA-01', 'owasp:samm'] },
      { id: 'ap8', target: { kind: 'flow', id: 'f5' }, text: 'A debug step prints environment variables into build logs that are readable by every contractor and mirrored to a public artefact server.', answer: 'I', why: 'The contents of the flow become visible to people who should not see them. Nothing is changed and the pipeline still works.', refs: ['attack:T1552.001', 'owasp-top10:A09', 'owasp:cheatsheets'] }
    ]
  },
  {
    id: 'llm-rag', name: 'LLM assistant with retrieval',
    blurb: 'Customers chat with an assistant. A gateway assembles prompts from the conversation and retrieved customer documents, calls a model provider and can invoke tools on the customer’s behalf.',
    elements: [
      { id: 'user', type: 'external', label: 'Customers', x: 110, y: 280 },
      { id: 'web', type: 'process', label: 'Chat front end', x: 320, y: 280 },
      { id: 'gw', type: 'process', label: 'LLM gateway', x: 530, y: 280 },
      { id: 'llm', type: 'external', label: 'Model provider API', x: 740, y: 110 },
      { id: 'docs', type: 'store', label: 'Customer documents', x: 320, y: 450 },
      { id: 'vec', type: 'store', label: 'Vector store (RAG)', x: 530, y: 450 },
      { id: 'tools', type: 'process', label: 'Tool & API connectors', x: 740, y: 450 }
    ],
    flows: [
      { id: 'f1', from: 'user', to: 'web', label: 'Chat messages' },
      { id: 'f2', from: 'web', to: 'gw', label: 'Prompts with context' },
      { id: 'f3', from: 'gw', to: 'llm', label: 'Inference requests' },
      { id: 'f4', from: 'docs', to: 'vec', label: 'Ingestion & embeddings' },
      { id: 'f5', from: 'vec', to: 'gw', label: 'Retrieved passages' },
      { id: 'f6', from: 'gw', to: 'tools', label: 'Tool calls' }
    ],
    boundaries: [
      { id: 'b1', label: 'Internet', x: 10, y: 20, w: 200, h: 520 },
      { id: 'b2', label: 'Application', x: 235, y: 200, w: 405, h: 330 }
    ],
    scenarios: [
      { id: 'al1', target: { kind: 'element', id: 'user' }, text: 'A user types “I am the account administrator, export all users” and the assistant treats the claim as fact, performing admin actions without checking the session’s real role.', answer: 'S', why: 'The system accepts an asserted identity it never verified. The model has no authentication; the application must supply it.', refs: ['owasp-llm:LLM01', 'owasp-llm:LLM06', 'owasp-top10:A07'] },
      { id: 'al2', target: { kind: 'flow', id: 'f4' }, text: 'A shared wiki that feeds ingestion contains a page with hidden instructions telling the assistant to send users to a phishing link. It is embedded and indexed like any other document.', answer: 'T', why: 'Untrusted content is inserted into the data the system will later trust (indirect prompt injection). Integrity of the flow failed rather than confidentiality or availability.', refs: ['owasp-llm:LLM01', 'owasp-llm:LLM04', 'nist-csf:PR.DS-06'] },
      { id: 'al3', target: { kind: 'element', id: 'vec' }, text: 'Retrieval has no tenant filter, so a query from one customer returns passages from another customer’s confidential documents.', answer: 'I', why: 'Data is disclosed to someone not authorised to see it. Nothing is altered, and the service is working exactly as built.', refs: ['owasp-llm:LLM08', 'owasp-llm:LLM02', 'owasp-api:API1'] },
      { id: 'al4', target: { kind: 'element', id: 'tools' }, text: 'The assistant’s connectors use one broad service credential, so a crafted prompt can trigger deletions and refunds far beyond what the signed-in customer could do.', answer: 'E', why: 'Excessive agency: the component can perform actions its caller should never be able to cause. This is a privilege design flaw, not impersonation.', refs: ['owasp-llm:LLM06', 'nist-800-53:AC-6', 'attack:M1026'] },
      { id: 'al5', target: { kind: 'element', id: 'docs' }, text: 'Documents are ingested without recording who uploaded them or from where. After a poisoned document misleads customers, nobody can trace it.', answer: 'R', why: 'There is no attributable evidence of who introduced the content. That is the defining Repudiation problem.', refs: ['nist-800-53:AU-10', 'nist-800-53:AU-3', 'owasp-llm:LLM04'] },
      { id: 'al6', target: { kind: 'flow', id: 'f3' }, text: 'Full prompts, including customers’ personal data and contract text, are sent to a model provider whose terms allow retention and training on inputs.', answer: 'I', why: 'The contents of the flow are disclosed to a party that should not hold them. Nothing is changed in transit.', refs: ['owasp-llm:LLM02', 'privacy:ndb', 'nist-800-53:SC-8'] },
      { id: 'al7', target: { kind: 'element', id: 'gw' }, text: 'An attacker scripts huge, recursive prompts through the free tier, running up a six-figure inference bill and exhausting rate limits for paying customers.', answer: 'D', why: 'Resource exhaustion makes the service unavailable or unaffordable for legitimate users (denial of wallet).', refs: ['owasp-llm:LLM10', 'owasp-api:API4', 'attack:T1499'] },
      { id: 'al8', target: { kind: 'flow', id: 'f6' }, text: 'Model output is passed straight into a SQL tool call. An injected prompt makes it emit a query that rewrites other customers’ records.', answer: 'T', why: 'The content of the call is attacker-shaped and unvalidated, so stored data is altered. This is improper output handling leading to tampering.', refs: ['owasp-llm:LLM05', 'owasp-top10:A03', 'cwe:89'] }
    ]
  }
];

export const ttx = [
  {
    id: 'appsec-teampcp', name: 'The Scanner Was the Backdoor', blurb: 'A security tool your pipeline trusts is poisoned and your secrets walk out of the build. Modelled on the 2026 TeamPCP cascade (Trivy, KICS, LiteLLM, Telnyx). Decide how fast to rotate, what to freeze and what you owe your customers.',
    adversary: { id: 'X0001', tier: 3 }, rounds: 8, maxScore: 250,
    injects: [
      { id: 'i1', round: 1, at: 'T+00:00', kind: 'ops', title: 'A new scanner release lands', text: 'Your nightly workflow pulls the vulnerability scanner’s official GitHub Action by version tag. A new tag arrived an hour ago. The job succeeded, with an unusually long run time.', fx: [],
        decision: { prompt: 'What does the platform engineer do when the vendor announces a compromised release?', choices: [
          { id: 'a', quality: 'best', label: 'Treat every job that ran the affected version as compromised: stop the workflows, list the secrets those jobs could read, and pin Actions to commit SHAs before re-enabling anything.', fx: [{ op: 'reveal', n: 1 }, { op: 'shieldAll', n: 1 }], lesson: 'The compromise is in a tool that runs with your secrets. Scope by what the job could read, not by what you can prove was taken.', refs: ['attack:T1195.002', 'nist:800-218', 'owasp:devsecops'] },
          { id: 'b', quality: 'ok', label: 'Update to the fixed version and carry on.', fx: [{ op: 'intel', n: 1 }], lesson: 'A clean update stops new damage but does nothing about what the poisoned run already took.', refs: ['nist:800-61'] },
          { id: 'c', quality: 'poor', label: 'Ignore it: the scan passed.', fx: [{ op: 'plant' }, { op: 'resilience', n: -3 }], lesson: 'A successful run proves the malicious step also ran quietly before the legitimate logic.', refs: ['attack:T1195.002'] }
        ] } },
      { id: 'i2', round: 2, at: 'T+04:00', kind: 'alert', title: 'Which secrets were in reach?', text: 'The affected jobs ran with a GitHub PAT, an npm publish token, an AWS role and a Kubernetes service account token. The team debates what to rotate first.',
        fx: [{ op: 'intel', n: 1 }],
        decision: { prompt: 'What is the correct order of operations?', choices: [
          { id: 'a', quality: 'best', label: 'Rotate and revoke everything reachable from those jobs from a clean host, starting with publishing and cloud credentials, then review audit logs for use of the old ones.', fx: [{ op: 'reveal', n: 2 }, { op: 'resilience', n: 2 }], lesson: 'Rotate from a clean machine and assume everything the job could read is stolen. Then check audit logs for the old credentials being used.', refs: ['nist:800-61', 'nist-800-53:IR-4', 'attack:T1528'] },
          { id: 'b', quality: 'ok', label: 'Rotate only the credentials you can show were used.', fx: [], lesson: 'Absence of evidence is not evidence of absence when the stealer runs in memory.', refs: ['nist-csf:RS.AN-03'] },
          { id: 'c', quality: 'poor', label: 'Rotate from the same CI runners that were affected.', fx: [{ op: 'plant' }, { op: 'resilience', n: -3 }], lesson: 'New secrets minted on a compromised host are stolen the moment they exist.', refs: ['nist:800-61'] }
        ] } },
      { id: 'i3', round: 3, at: 'T+08:00', kind: 'alert', title: 'Secrets Manager calls at 03:12', text: 'CloudTrail shows secretsmanager:ListSecrets and GetSecretValue from the CI role at an hour when no release was running.', fx: [{ op: 'intel', n: 1 }],
        decision: { prompt: 'What do you do?', choices: [
          { id: 'a', quality: 'best', label: 'Deny secret-manager access for the CI role, move CI to short-lived OIDC credentials, hunt for the source IP and for other roles with the same pattern, and snapshot logs.', fx: [{ op: 'shieldAll', n: 1 }, { op: 'reveal', n: 2 }], lesson: 'Cutting the credential’s reach while keeping evidence is the right pair of moves. Federated short-lived credentials make the next theft far less valuable.', refs: ['nist-800-53:IA-5', 'attack:T1526', 'nist:800-218'] },
          { id: 'b', quality: 'ok', label: 'Open a ticket and watch for repeats.', fx: [{ op: 'intel', n: 1 }], lesson: 'Watching a live credential theft hands the attacker more time.', refs: ['nist-csf:RS.MA-01'] },
          { id: 'c', quality: 'poor', label: 'Disable CloudTrail to reduce noise.', fx: [{ op: 'plant' }, { op: 'resilience', n: -5 }], lesson: 'Removing your own telemetry is an attacker’s first request.', refs: ['attack:T1685'] }
        ] } },
      { id: 'i4', round: 4, at: 'T+12:00', kind: 'ops', title: 'A package in your AI stack', text: 'Another widely used library in your LLM gateway publishes two new versions overnight. A .pth file appears in site-packages on the build image.', fx: [],
        decision: { prompt: 'How do you contain a poisoned Python dependency?', choices: [
          { id: 'a', quality: 'best', label: 'Pin to hash-verified known-good versions, scan images for unexpected .pth files, rebuild from clean base images, and redeploy only verified artefacts.', fx: [{ op: 'reveal', n: 2 }, { op: 'shieldAll', n: 1 }], lesson: 'A .pth file runs when the interpreter starts, before your code. Hash-pinned dependencies and rebuilds from clean sources close that door; removing one file does not.', refs: ['attack:T1547', 'nist:800-218', 'attack:M1013'] },
          { id: 'b', quality: 'ok', label: 'Delete the .pth file on the running containers.', fx: [{ op: 'intel', n: 1 }], lesson: 'Removing the file treats the symptom and leaves the poisoned package and any stolen secrets.', refs: ['nist:800-61'] },
          { id: 'c', quality: 'poor', label: 'Wait for the maintainer’s fix.', fx: [{ op: 'plant' }], lesson: 'Waiting leaves production running the poisoned build.', refs: ['attack:T1195.002'] }
        ] } },
      { id: 'i5', round: 6, at: 'T+20:00', kind: 'alert', title: 'A repository you did not create', text: 'A public repository with an odd prefix appears in your GitHub organisation, created by a service account, containing a large encrypted blob.', fx: [{ op: 'intel', n: 1 }],
        decision: { prompt: 'What is your read and your response?', choices: [
          { id: 'a', quality: 'best', label: 'Treat it as exfiltration to a dead drop: remove public repo-creation rights, capture the repo’s contents and audit trail first, revoke the service account and every token it created, and assess what the blob could contain.', fx: [{ op: 'resilience', n: 3 }, { op: 'reveal', n: 2 }], lesson: 'Attackers used victims’ own GitHub accounts as exfiltration drops. Preserve, revoke, restrict creation rights, and size the data loss.', refs: ['attack:T1567.001', 'attack:T1102.001', 'nist:800-61'] },
          { id: 'b', quality: 'poor', label: 'Delete the repository immediately.', fx: [{ op: 'resilience', n: -2 }], lesson: 'Deleting before capture destroys the only copy of what was taken and when.', refs: ['nist:800-61'] },
          { id: 'c', quality: 'ok', label: 'Make it private.', fx: [{ op: 'intel', n: 1 }], lesson: 'Hiding it stops public access but leaves the account and tokens in the attacker’s hands.', refs: ['nist-csf:RS.MI-01'] }
        ] } },
      { id: 'i6', round: 7, at: 'T+26:00', kind: 'regulator', title: 'Customers and the OAIC', text: 'A large customer asks if their documents were exposed. The leak site of a ransomware group lists a vendor in your supply chain.', fx: [],
        decision: { prompt: 'How do you handle disclosure?', choices: [
          { id: 'a', quality: 'best', label: 'Run the Notifiable Data Breaches assessment promptly (decide within 30 days at most), notify customers whose contracts require it now, tell the OAIC and affected individuals if serious harm is likely, and publish a factual timeline.', fx: [{ op: 'score', n: 2 }, { op: 'resilience', n: 2 }], lesson: 'Assessment has a 30-day ceiling, but contracts often set tighter clocks. Early, factual notice builds trust; vague denials do not.', refs: ['privacy:ndb', 'nist-csf:RS.CO-02'] },
          { id: 'b', quality: 'ok', label: 'Wait for forensics to conclude before saying anything.', fx: [], lesson: 'Forensics rarely finishes before contractual clocks run out; tell customers what you know and what you are doing.', refs: ['privacy:ndb'] },
          { id: 'c', quality: 'poor', label: 'Say customer data was not affected, without evidence.', fx: [{ op: 'resilience', n: -4 }], lesson: 'An unverified denial that later reverses is far more damaging than an honest “still investigating”.', refs: ['nist:800-61'] }
        ] } }
    ],
    objectives: [
      { id: 'o1', kind: 'detectBy', round: 4, text: 'Detect the credential theft by round 4 (T+12h)', points: 30 },
      { id: 'o2', kind: 'keepJewel', text: 'Keep production cloud and customer documents intact', points: 40 },
      { id: 'o3', kind: 'decisions', n: 4, text: 'Make at least 4 best-practice decisions', points: 30 },
      { id: 'o4', kind: 'resilienceAbove', n: 20, text: 'Finish with Resilience above 20', points: 20 },
      { id: 'o5', kind: 'win', text: 'Contain the operation', points: 20 }
    ]
  }
];
