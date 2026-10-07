export const base = {
  schema: 2, id: 'banking', kind: 'scenario', name: 'Banking & Payments',
  tagline: 'Money moves in minutes. So must your response.',
  icon: 'landmark',
  theme: { accent: '#4ade80', accent2: '#22d3ee', bg: ['#04140d', '#072218', '#0a2e22'] },
  org: {
    name: 'Southern Cross Mutual Bank', sector: 'Retail banking & payments (Australia)',
    brief: 'A mutual bank with 400,000 members, branches, a mobile app, a card programme and direct SWIFT connectivity for international payments. The payments team works on the same Active Directory as everyone else, the weekend roster is thin, and the core banking platform has been customised for twenty years.',
    crownJewels: ['Core banking platform', 'SWIFT gateway & payment hub'],
    regimes: [
      { name: 'APRA CPS 234 — Information Security', note: 'Regulated entities must maintain information security capability commensurate with threats, test controls, and notify APRA of material information security incidents within 72 hours of becoming aware.', refs: ['apra:cps234'] },
      { name: 'APRA CPS 230 — Operational Risk Management', note: 'In force from 1 July 2025: critical operations must stay within board-approved tolerances through disruption, and material service providers must be managed.', refs: ['apra:cps230'] },
      { name: 'SWIFT Customer Security Programme & PCI DSS', note: 'SWIFT users attest annually to mandatory controls; anyone storing or processing card data must meet PCI DSS. Both are contractual rather than statutory.', refs: ['swift:CSP', 'pci:v4'] }
    ]
  },
  assets: [
    { id: 'web', name: 'Online & Mobile Banking', kind: 'app', zone: 'Internet-facing', hp: 8, jewel: false, exposed: true, icon: 'smartphone', desc: 'The member-facing web app and mobile API.', adjacent: ['cards', 'idp'] },
    { id: 'mail', name: 'Corporate Email', kind: 'email', zone: 'Corporate', hp: 6, jewel: false, exposed: true, icon: 'mail', desc: 'Staff email, including the payments team.', adjacent: ['ws', 'idp'] },
    { id: 'ws', name: 'Staff Workstations', kind: 'endpoint', zone: 'Corporate', hp: 8, jewel: false, exposed: true, icon: 'laptop', desc: 'Branch and head-office endpoints.', adjacent: ['mail', 'idp', 'ops'] },
    { id: 'ops', name: 'Payments Operator Desktops', kind: 'endpoint', zone: 'Payments', hp: 8, jewel: false, exposed: false, icon: 'monitor', desc: 'Operators who prepare and approve international payments.', adjacent: ['ws', 'idp', 'swift'] },
    { id: 'idp', name: 'Identity & Privileged Access', kind: 'identity', zone: 'Corporate', hp: 8, jewel: false, exposed: false, icon: 'id-card', desc: 'Directory, SSO and privileged-access vault.', adjacent: ['web', 'mail', 'ws', 'ops', 'core'] },
    { id: 'cards', name: 'Card Processing (PCI zone)', kind: 'server', zone: 'Cardholder data', hp: 8, jewel: false, exposed: false, icon: 'credit-card', desc: 'Authorisation and the cardholder-data environment.', adjacent: ['web', 'core'] },
    { id: 'core', name: 'Core Banking Platform', kind: 'app', zone: 'Core', hp: 12, jewel: true, exposed: false, icon: 'landmark', desc: 'Ledger, accounts and interest: the system of record.', adjacent: ['idp', 'cards', 'swift', 'bk'] },
    { id: 'swift', name: 'SWIFT Gateway & Payment Hub', kind: 'server', zone: 'Payments', hp: 10, jewel: true, exposed: false, icon: 'banknote', desc: 'Where international payment messages are built, approved and sent.', adjacent: ['ops', 'core'] },
    { id: 'bk', name: 'Backup & DR', kind: 'backup', zone: 'Core', hp: 6, jewel: false, exposed: false, icon: 'database-backup', desc: 'Backups and the disaster-recovery site.', adjacent: ['core'] }
  ],
  roster: { acts: [
    { name: 'Act I — Crime at the Edge', battle: ['G0092', 'G1043', 'G1032', 'G1051'], elite: ['G0046'], boss: 'G0037', tiers: { battle: 1, elite: 2, boss: 2 } },
    { name: 'Act II — Organised Fraud', battle: ['G0102', 'G0080', 'G0091'], elite: ['G0032'], boss: 'G0082', tiers: { battle: 2, elite: 2, boss: 3 } },
    { name: 'Act III — Social Engineering and Supply Chain', battle: ['G1057', 'C0059', 'G0096'], elite: ['C0057'], boss: 'G1015', tiers: { battle: 2, elite: 3, boss: 3 } }
  ] },
  reading: [
    { title: 'APRA CPS 234 — Information Security', url: 'https://www.apra.gov.au/consolidated-prudential-standard-cps-234-information-security' },
    { title: 'APRA CPS 230 — Operational Risk Management', url: 'https://www.apra.gov.au/operational-risk-management' },
    { title: 'SWIFT Customer Security Programme', url: 'https://www.swift.com/myswift/customer-security-programme-csp' },
    { title: 'CISA AA20-239A — FASTCash 2.0: North Korea’s BeagleBoyz robbing banks', url: 'https://www.cisa.gov/news-events/cybersecurity-advisories/aa20-239a' },
    { title: 'PCI DSS v4.0 — document library', url: 'https://www.pcisecuritystandards.org/document_library/' }
  ]
};

export const overrides = {
  'govern.spoofing': { name: 'Payments Access & Dual Control Policy', flavour: 'No payment moves on one person’s say-so', desc: 'Policy requiring maker-checker separation, named approvers, dual authorisation above thresholds and recertification of payments-system access every quarter.', refs: ['swift:CSP', 'apra:cps234', 'nist-csf:GV.RR-02'] },
  'govern.dos': { name: 'CPS 230 Tolerance Levels', flavour: 'How long can payments be down?', desc: 'Board-approved tolerances for critical operations (payments, cash, core banking) with the controls, testing and provider arrangements needed to stay inside them.', refs: ['apra:cps230', 'nist-csf:GV.OC-04', 'soci:overview'] },
  'identify.disclosure': { name: 'Information Asset Classification', flavour: 'Which tables hold card numbers and balances?', desc: 'A register of information assets with owner, criticality and sensitivity that drives the strength of control, as CPS 234 requires.', refs: ['apra:cps234', 'nist-csf:ID.AM-05', 'pci:v4'] },
  'identify.tampering': { name: 'Payment Flow & Message Map', flavour: 'Where can a payment change after approval?', desc: 'A map of every hop a payment instruction takes from operator to network, with the point where integrity is verified and the point where it is not.', refs: ['swift:CSP', 'owasp:threat-dragon', 'nist-csf:ID.AM-03'] },
  'protect.spoofing': { name: 'Phishing-resistant MFA for Payments', flavour: 'Hardware keys for the people who can move money', desc: 'FIDO2 hardware tokens for payment operators, administrators and anyone with privileged access to the payment hub or gateway.', refs: ['attack:M1032', 'nist:800-63', 'swift:CSP', 'nist-csf:PR.AA-03'] },
  'protect.tampering': { name: 'Message Integrity & Secure Zone', flavour: 'Sign it before it leaves the hub', desc: 'A segregated SWIFT secure zone with message signing and application allow-listing on the gateway, so an approved payment cannot be altered between approval and transmission.', refs: ['swift:CSP', 'attack:M1038', 'nist-800-53:SI-7', 'pci:v4'] },
  'protect.elevation': { name: 'Privileged Access Management', flavour: 'Admin rights are borrowed, never owned', desc: 'Time-boxed, approved, recorded privileged sessions to core, gateway and database, with no standing domain-admin accounts on operator or branch machines.', refs: ['attack:M1026', 'nist-800-53:AC-6', 'swift:CSP'] },
  'detect.repudiation': { name: 'Payment Anomaly & Fraud Analytics', flavour: 'A new payee on a Friday night is a question', desc: 'Real-time analytics on beneficiaries, amounts, timing and operator behaviour, with an on-call analyst who can hold a payment.', refs: ['nist-csf:DE.AE-02', 'apra:cps234', 'swift:CSP'] },
  'respond.disclosure': { name: 'APRA & Regulator Notification Playbook', flavour: '72 hours starts when you become aware', desc: 'A decision tree and drafts for notifying APRA of material incidents (72 hours under CPS 234), assessing AUSTRAC suspicious-matter obligations and OAIC notifiable data breaches.', refs: ['apra:cps234', 'apra:cps230', 'privacy:ndb', 'nist-csf:RS.CO-02'] },
  'respond.tampering': { name: 'Payment Recall & Gateway Isolation', flavour: 'Call the correspondent before the money moves', desc: 'Pre-agreed ability to suspend the gateway, contact SWIFT and correspondent banks to recall payments, and switch to manual verification.', refs: ['swift:CSP', 'nist-csf:RS.MI-01', 'nist:800-61'] },
  'recover.dos': { name: 'Immutable Ledger Backups & DR', flavour: 'Reconstruct the ledger to the last verified second', desc: 'Immutable backups and a tested disaster-recovery site that restore the core ledger and payment hub within the CPS 230 tolerance.', refs: ['apra:cps230', 'e8:backups', 'nist-csf:RC.RP-03'] }
};

export const cards = [
  { id: 'bank.dual-control', name: 'Maker-Checker Dual Control', type: 'control', fn: 'protect', prop: 'spoofing', cost: 2, rarity: 'uncommon', target: 'asset', ward: { S: 1, E: 2 }, mit: ['M1026', 'M1032'], desc: 'Two different people must create and approve each payment. +1 Authentication ward, +2 Authorisation ward.', lesson: 'Separation of duties turns one stolen account into a failed payment. The Bangladesh Bank thieves needed operator credentials for both roles; dual control only works when the two identities are genuinely independent.', refs: ['swift:CSP', 'nist-800-53:AC-5', 'attack:M1026'] },
  { id: 'bank.velocity', name: 'Velocity & Beneficiary Checks', type: 'action', fn: 'detect', prop: 'repudiation', cost: 1, rarity: 'common', fx: [{ op: 'reveal', n: 1, str: 5 }, { op: 'shieldExfil', n: 2 }, { op: 'intel', n: 1 }], desc: 'Hold unusual payments for review: reveal a foothold (stealth ≤ 5), cut this round’s exfiltration by 2, +1 intel.', lesson: 'Most payment fraud shows up as behaviour, not malware: new beneficiary, odd hour, round amounts, a dozen messages in quick succession. A hold-and-call-back process buys the hours recall needs.', refs: ['nist-csf:DE.AE-02', 'swift:CSP', 'attack:T1657'] },
  { id: 'bank.swift-secure-zone', name: 'SWIFT Secure Zone', type: 'augment', fn: 'protect', prop: 'tampering', cost: 1, rarity: 'rare', target: 'control', base: ['protect.tampering', 'protect.elevation'], aug: { ward: { T: 1, E: 1 }, expert: [{ tech: 'T1657', ref: 'swift:CSP' }] }, desc: 'Gateway sits in a segregated zone with allow-listed software and separate credentials. Counters Financial Theft.', lesson: 'SWIFT’s mandatory controls start with isolating the payment environment from the general network. Segregation turns a phished workstation into a stepping stone instead of a payment.', refs: ['swift:CSP', 'attack:T1657', 'nist-800-53:SC-7'] }
];
export const relics = [
  { id: 'bank.cps230', name: 'CPS 230 Tolerance Programme', icon: 'scale', rarity: 'uncommon', hooks: { passive: { maxResilience: 8 }, roundStart: [{ op: 'intel', n: 1 }] }, desc: '+8 max Resilience. +1 intel each round.', lesson: 'Setting and testing impact tolerances makes resilience a measured property rather than a hope. It is also how APRA examines you.', refs: ['apra:cps230', 'nist-csf:GV.OC-04'] }
];

export const systems = [
  {
    id: 'swift-payments', name: 'International payments path',
    blurb: 'An operator prepares a payment in the hub. Limits and beneficiary lists are checked, a fraud engine scores it, an approver releases it, and the SWIFT gateway signs and sends the message.',
    elements: [
      { id: 'operator', type: 'external', label: 'Payments operators', x: 110, y: 280 },
      { id: 'limits', type: 'store', label: 'Limits & beneficiaries', x: 320, y: 110 },
      { id: 'hub', type: 'process', label: 'Payment hub', x: 320, y: 280 },
      { id: 'fraud', type: 'process', label: 'Fraud engine', x: 320, y: 450 },
      { id: 'ledger', type: 'store', label: 'Core ledger', x: 530, y: 110 },
      { id: 'swift', type: 'process', label: 'SWIFT gateway', x: 530, y: 280 },
      { id: 'logs', type: 'store', label: 'Message audit logs', x: 530, y: 450 },
      { id: 'net', type: 'external', label: 'SWIFT network & banks', x: 740, y: 280 }
    ],
    flows: [
      { id: 'f1', from: 'operator', to: 'hub', label: 'Payment instructions' },
      { id: 'f2', from: 'limits', to: 'hub', label: 'Limit & payee checks' },
      { id: 'f3', from: 'hub', to: 'swift', label: 'Approved messages' },
      { id: 'f4', from: 'swift', to: 'net', label: 'SWIFT messages' },
      { id: 'f5', from: 'hub', to: 'ledger', label: 'Ledger postings' },
      { id: 'f6', from: 'fraud', to: 'hub', label: 'Risk decisions' }
    ],
    boundaries: [
      { id: 'b1', label: 'Operations', x: 10, y: 180, w: 200, h: 200 },
      { id: 'b2', label: 'Bank payment zone', x: 235, y: 50, w: 405, h: 470 },
      { id: 'b3', label: 'SWIFT network', x: 655, y: 200, w: 200, h: 160 }
    ],
    scenarios: [
      { id: 'bk1', target: { kind: 'element', id: 'operator' }, text: 'An attacker logs in to the payment hub using a stolen operator password and token, and is accepted as a trusted employee.', answer: 'S', why: 'The attacker is accepted as someone they are not. No payment has been changed yet; the failure is identity assurance for a high-risk role.', refs: ['attack:T1078', 'attack:M1032', 'swift:CSP'] },
      { id: 'bk2', target: { kind: 'flow', id: 'f3' }, text: 'Malware on the gateway changes the beneficiary account number inside an already-approved message just before it is signed and sent.', answer: 'T', why: 'The content of an approved instruction is altered between approval and transmission. Integrity of the flow failed, not confidentiality or availability.', refs: ['attack:T1565.002', 'attack:T1657', 'swift:CSP'] },
      { id: 'bk3', target: { kind: 'element', id: 'limits' }, text: 'A compromised administrator quietly raises transaction limits and adds a new beneficiary to the allow-list, ready for later use.', answer: 'T', why: 'Stored configuration that later decisions rely on is altered without authority. This is tampering with a store, not disclosure or denial.', refs: ['attack:T1565.001', 'attack:T1098', 'nist-800-53:AC-5'] },
      { id: 'bk4', target: { kind: 'element', id: 'ledger' }, text: 'A support engineer with broad database read access runs queries that return every member’s balance and recent transactions.', answer: 'I', why: 'Sensitive stored data is readable by someone who does not need it. Nothing is modified and the system is up; the failure is confidentiality.', refs: ['attack:T1213', 'privacy:ndb', 'nist-800-53:AC-6'] },
      { id: 'bk5', target: { kind: 'element', id: 'swift' }, text: 'The role that prepares payments also has the right to approve them, so one compromised operator account can release its own payment.', answer: 'E', why: 'A role can perform actions it should never combine. This is a separation-of-duties failure, not impersonation or tampering in transit.', refs: ['nist-800-53:AC-5', 'swift:CSP', 'attack:M1026'] },
      { id: 'bk6', target: { kind: 'element', id: 'logs' }, text: 'A gateway administrator can delete message audit logs, and after a fraudulent payment the bank cannot prove what was sent or by whom.', answer: 'R', why: 'There is no tamper-evident record, so actions can be denied and cannot be proved. That is the defining Repudiation problem.', refs: ['attack:T1070', 'nist-800-53:AU-9', 'nist-800-53:AU-10'] },
      { id: 'bk7', target: { kind: 'flow', id: 'f4' }, text: 'A circuit cut and a flood against the bank’s SWIFT connectivity prevent messages being sent just before end-of-day cut-off.', answer: 'D', why: 'The channel is unavailable to legitimate use at the worst time. Nothing is forged, altered or read.', refs: ['attack:T1498', 'apra:cps230', 'attack:M1037'] },
      { id: 'bk8', target: { kind: 'flow', id: 'f1' }, text: 'Operators sometimes send full payment instructions, with account numbers and amounts, by ordinary email when the hub is slow, and the mailbox is shared.', answer: 'I', why: 'The contents of the flow are visible to people and systems that should not see them. Nothing is altered in transit.', refs: ['attack:T1114', 'swift:CSP', 'nist-800-53:SC-8'] }
    ]
  },
  {
    id: 'digital-cards', name: 'Digital banking, cards & open banking',
    blurb: 'Members use the app and web. Card payments go through a PCI-scoped processor that stores card data and talks to the card schemes. Fintech partners reach account data through consent-based APIs.',
    elements: [
      { id: 'cust', type: 'external', label: 'Members', x: 110, y: 280 },
      { id: 'app', type: 'process', label: 'Mobile & online banking', x: 320, y: 280 },
      { id: 'acct', type: 'store', label: 'Account database', x: 320, y: 450 },
      { id: 'api', type: 'process', label: 'Open banking API', x: 530, y: 110 },
      { id: 'cde', type: 'process', label: 'Card processing (CDE)', x: 530, y: 280 },
      { id: 'vault', type: 'store', label: 'Card data vault', x: 530, y: 450 },
      { id: 'third', type: 'external', label: 'Fintech partners', x: 740, y: 110 },
      { id: 'schemes', type: 'external', label: 'Card schemes', x: 740, y: 280 }
    ],
    flows: [
      { id: 'f1', from: 'cust', to: 'app', label: 'Payments & logins' },
      { id: 'f2', from: 'app', to: 'acct', label: 'Account queries' },
      { id: 'f3', from: 'app', to: 'cde', label: 'Card payments' },
      { id: 'f4', from: 'cde', to: 'vault', label: 'Card data storage' },
      { id: 'f5', from: 'cde', to: 'schemes', label: 'Authorisations' },
      { id: 'f6', from: 'third', to: 'api', label: 'Consented API calls' },
      { id: 'f7', from: 'api', to: 'acct', label: 'Shared account data' }
    ],
    boundaries: [
      { id: 'b1', label: 'Internet', x: 10, y: 20, w: 200, h: 520 },
      { id: 'b2', label: 'Bank platform', x: 235, y: 50, w: 405, h: 470 }
    ],
    scenarios: [
      { id: 'cb1', target: { kind: 'element', id: 'cust' }, text: 'A fraudster social-engineers the mobile carrier into moving a member’s number to a new SIM and receives the one-time passcodes the bank sends.', answer: 'S', why: 'The attacker is accepted as the member because a weak factor was hijacked. No data or code has changed; identity assurance failed.', refs: ['attack:T1111', 'nist:800-63', 'attack:M1032'] },
      { id: 'cb2', target: { kind: 'flow', id: 'f1' }, text: 'Malware in a member’s browser rewrites the payee and amount in a payment request after the member confirms it on screen.', answer: 'T', why: 'The content of the request is altered in transit between the user and the app. Integrity of the flow failed, not secrecy or availability.', refs: ['attack:T1185', 'owasp-top10:A04', 'attack:M1054'] },
      { id: 'cb3', target: { kind: 'element', id: 'vault' }, text: 'A SQL injection flaw in a reporting tool dumps the card data vault, which stores full card numbers with weak encryption.', answer: 'I', why: 'Sensitive stored data is disclosed to an attacker. Nothing is altered or taken offline; the failure is confidentiality of the store.', refs: ['owasp-top10:A03', 'pci:v4', 'attack:T1005'] },
      { id: 'cb4', target: { kind: 'element', id: 'api' }, text: 'The open banking API checks that a partner token is valid but not which accounts the member consented to share, so partners can read any account.', answer: 'E', why: 'A caller can do more than it was authorised to do. This is an authorisation flaw (excess privilege), not impersonation.', refs: ['owasp-api:API1', 'owasp-api:API5', 'nist-800-53:AC-6'] },
      { id: 'cb5', target: { kind: 'element', id: 'acct' }, text: 'An attacker with a stolen DBA credential changes the stored daily transfer limits on thousands of accounts.', answer: 'T', why: 'Stored data that controls later decisions is changed without authority. This is tampering with the store.', refs: ['attack:T1565.001', 'attack:T1078', 'nist-800-53:AC-6'] },
      { id: 'cb6', target: { kind: 'flow', id: 'f5' }, text: 'A saturation attack on the link to the card schemes blocks authorisations during a peak shopping weekend.', answer: 'D', why: 'The channel is made unavailable when demand is highest. Nothing is forged, altered or read.', refs: ['attack:T1498', 'apra:cps230', 'attack:M1037'] },
      { id: 'cb7', target: { kind: 'element', id: 'cde' }, text: 'Support staff can override card authorisation decisions, and the processor records neither who did it nor why.', answer: 'R', why: 'There is no attributable evidence of who changed an outcome. That is the defining Repudiation problem.', refs: ['nist-800-53:AU-10', 'pci:v4', 'nist-800-53:AU-3'] },
      { id: 'cb8', target: { kind: 'flow', id: 'f6' }, text: 'A partner integration negotiates a downgraded TLS version, and an attacker on a hotel network captures access tokens and responses.', answer: 'I', why: 'The content of the flow is captured by an eavesdropper. Altering or blocking traffic would be a different threat.', refs: ['attack:T1040', 'attack:M1041', 'owasp-api:API8'] }
    ]
  }
];

export const ttx = [
  {
    id: 'bank-swift-heist', name: 'Friday Night Payments', blurb: 'Malware prepares and sends fraudulent international payments over a weekend while the regular team is away. Modelled on the documented Bangladesh Bank heist and the APT38 playbook (MITRE G0082). Stop the money, notify the right regulators, and keep the bank running.',
    adversary: { id: 'G0082', tier: 3 }, rounds: 8, maxScore: 250,
    injects: [
      { id: 'i1', round: 1, at: 'T+00:00', kind: 'ops', title: 'The confirmation printer is out of order', text: 'On Friday evening the printer that outputs SWIFT confirmations stops working. A ticket is raised for Monday.', fx: [],
        decision: { prompt: 'What does the duty manager do?', choices: [
          { id: 'a', quality: 'best', label: 'Treat a failed confirmation channel on the payment gateway as a security-relevant fault: reconcile the gateway’s message log against the ledger now and get the payments security lead on the phone.', fx: [{ op: 'reveal', n: 1 }, { op: 'intel', n: 1 }], lesson: 'Attackers disable the control that would reveal fraud (printed confirmations, reconciliation) before sending. A failure in an assurance control is a signal.', refs: ['swift:CSP', 'attack:T1685', 'nist-csf:DE.AE-02'] },
          { id: 'b', quality: 'ok', label: 'Check the printer on Monday and log the ticket as low priority.', fx: [], lesson: 'The weekend is when the window is widest. Low-priority tickets are where attackers hide.', refs: ['nist-csf:DE.CM-01'] },
          { id: 'c', quality: 'poor', label: 'Print the confirmations manually from the gateway and continue.', fx: [{ op: 'plant' }, { op: 'resilience', n: -2 }], lesson: 'Working around the failed control removes the independent check the bank relied on.', refs: ['swift:CSP'] }
        ] } },
      { id: 'i2', round: 2, at: 'T+06:00', kind: 'alert', title: 'A correspondent bank asks about a payment', text: 'A correspondent bank calls: they have received a series of payments to a new beneficiary and want to confirm they are genuine. Your ledger shows no such transactions.', fx: [{ op: 'intel', n: 1 }],
        decision: { prompt: 'What is the priority in the next hour?', choices: [
          { id: 'a', quality: 'best', label: 'Suspend the SWIFT gateway, contact SWIFT and the correspondent and beneficiary banks to stop and recall the payments, and preserve the gateway’s memory and logs.', fx: [{ op: 'shieldAll', n: 1 }, { op: 'reveal', n: 2 }, { op: 'score', n: 1 }], lesson: 'In payment fraud the clock is the loss. Recall requests in the first hours recover money later requests cannot. Preserve evidence at the same time.', refs: ['swift:CSP', 'nist:800-61', 'nist-csf:RS.MI-01'] },
          { id: 'b', quality: 'ok', label: 'Ask the correspondent to wait while IT investigates.', fx: [{ op: 'intel', n: 1 }], lesson: 'Delay lets the beneficiary withdraw the funds.', refs: ['nist-csf:RS.MA-01'] },
          { id: 'c', quality: 'poor', label: 'Reboot the gateway to clear any fault.', fx: [{ op: 'plant' }, { op: 'resilience', n: -4 }], lesson: 'A reboot destroys volatile evidence and may remove the malware the attacker wants you to find late.', refs: ['nist:800-61'] }
        ] } },
      { id: 'i3', round: 3, at: 'T+10:00', kind: 'regulator', title: 'Is this notifiable to APRA?', text: 'The CRO asks whether this is a material information security incident and what the clock is.', fx: [],
        decision: { prompt: 'What is the correct approach?', choices: [
          { id: 'a', quality: 'best', label: 'Treat it as material: notify APRA within 72 hours of becoming aware under CPS 234 (earlier is better), start the AUSTRAC suspicious-matter assessment, and brief the board chair.', fx: [{ op: 'score', n: 2 }], lesson: 'CPS 234 sets 72 hours from awareness for material incidents. Notify early and update, and assess AUSTRAC and OAIC obligations in parallel.', refs: ['apra:cps234', 'apra:cps230', 'privacy:ndb'] },
          { id: 'b', quality: 'ok', label: 'Wait until forensics determines the loss before deciding.', fx: [], lesson: 'The clock starts at awareness, not at the end of the investigation.', refs: ['apra:cps234'] },
          { id: 'c', quality: 'poor', label: 'Do not notify: the money may still be recalled.', fx: [{ op: 'resilience', n: -3 }], lesson: 'Possible recovery does not remove the obligation. Late disclosure damages regulatory trust.', refs: ['apra:cps234'] }
        ] } },
      { id: 'i4', round: 5, at: 'T+18:00', kind: 'exec', title: 'How did they get in?', text: 'Forensics finds that the attacker used the credentials of a payments operator, and a tool that sends messages directly to the gateway’s interface, bypassing the hub’s approvals.', fx: [{ op: 'intel', n: 1 }],
        decision: { prompt: 'What is the most valuable change to make right now?', choices: [
          { id: 'a', quality: 'best', label: 'Enforce phishing-resistant MFA and separate credentials for the payment environment, block direct access to the gateway interface from anywhere but the hub, and re-verify maker-checker separation.', fx: [{ op: 'shieldAll', n: 1 }, { op: 'resilience', n: 2 }], lesson: 'The attack combined credential theft with a path that bypassed approvals. Fix the identity, the path and the control at the same time.', refs: ['swift:CSP', 'attack:M1032', 'attack:M1030'] },
          { id: 'b', quality: 'ok', label: 'Reset all operator passwords.', fx: [{ op: 'intel', n: 1 }], lesson: 'A reset helps but leaves the bypass path open.', refs: ['nist-800-53:IA-5'] },
          { id: 'c', quality: 'poor', label: 'Return to normal operations to avoid disruption.', fx: [{ op: 'plant' }], lesson: 'Resuming with the same weakness invites a repeat.', refs: ['nist:800-61'] }
        ] } },
      { id: 'i5', round: 7, at: 'T+30:00', kind: 'comms', title: 'Members and the media', text: 'The financial press is asking about “a cyber heist at an Australian mutual bank” and members are calling branches.', fx: [],
        decision: { prompt: 'What is the holding statement?', choices: [
          { id: 'a', quality: 'best', label: 'Confirm that a cyber incident affected payments, that member accounts and deposits are safe and unaffected, regulators are notified, and a dedicated line is open; commit to updates.', fx: [{ op: 'score', n: 1 }, { op: 'resilience', n: 3 }], lesson: 'In a bank, confidence is the product. Say what is safe, what you know and when you will update; do not speculate on the amount.', refs: ['nist-csf:RS.CO-02', 'apra:cps230'] },
          { id: 'b', quality: 'poor', label: 'Say there was no cyber incident.', fx: [{ op: 'resilience', n: -4 }], lesson: 'A denial that is reversed is worse than the incident.', refs: ['nist:800-61'] },
          { id: 'c', quality: 'ok', label: 'No comment.', fx: [], lesson: 'Silence lets rumour set the narrative.', refs: ['nist-csf:RS.CO-02'] }
        ] } }
    ],
    objectives: [
      { id: 'o1', kind: 'detectBy', round: 3, text: 'Detect the intrusion by round 3 (T+10h)', points: 30 },
      { id: 'o2', kind: 'keepJewel', text: 'Keep the core platform and payment gateway under your control', points: 40 },
      { id: 'o3', kind: 'decisions', n: 3, text: 'Make at least 3 best-practice decisions', points: 30 },
      { id: 'o4', kind: 'resilienceAbove', n: 20, text: 'Finish with Resilience above 20', points: 20 },
      { id: 'o5', kind: 'win', text: 'Contain the operation', points: 20 }
    ]
  }
];
