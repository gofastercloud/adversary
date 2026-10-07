// Enterprise IT scenario content (assets, roster live in the JSON header below; systems/TTX authored here).
export const systems = [
  {
    id: 'hybrid-identity', name: 'Hybrid identity & Microsoft 365',
    blurb: 'Staff and contractors reach Microsoft 365 through an identity provider synchronised with on-premises Active Directory. An outsourced service desk resets credentials.',
    elements: [
      { id: 'user', type: 'external', label: 'Staff & contractors', x: 110, y: 280 },
      { id: 'desk', type: 'external', label: 'Outsourced service desk', x: 110, y: 450 },
      { id: 'mail', type: 'process', label: 'Mail gateway', x: 320, y: 110 },
      { id: 'idp', type: 'process', label: 'Identity provider', x: 320, y: 280 },
      { id: 'm365', type: 'process', label: 'M365 apps', x: 530, y: 110 },
      { id: 'docs', type: 'store', label: 'SharePoint & OneDrive', x: 530, y: 280 },
      { id: 'ad', type: 'process', label: 'On-prem Active Directory', x: 530, y: 450 },
      { id: 'logs', type: 'store', label: 'SIEM log store', x: 740, y: 280 },
      { id: 'paw', type: 'process', label: 'Admin workstation', x: 740, y: 450 }
    ],
    flows: [
      { id: 'f1', from: 'user', to: 'mail', label: 'Inbound email' },
      { id: 'f2', from: 'user', to: 'idp', label: 'Sign-in' },
      { id: 'f3', from: 'idp', to: 'm365', label: 'Tokens (OIDC/SAML)' },
      { id: 'f4', from: 'm365', to: 'docs', label: 'Read / write files' },
      { id: 'f5', from: 'desk', to: 'idp', label: 'Credential resets' },
      { id: 'f6', from: 'ad', to: 'idp', label: 'Directory sync' },
      { id: 'f7', from: 'paw', to: 'ad', label: 'Admin protocols' },
      { id: 'f8', from: 'idp', to: 'logs', label: 'Sign-in logs' }
    ],
    boundaries: [
      { id: 'b1', label: 'Internet & third parties', x: 10, y: 20, w: 200, h: 520 },
      { id: 'b2', label: 'Cloud tenant', x: 228, y: 40, w: 400, h: 300 },
      { id: 'b3', label: 'On-premises', x: 440, y: 380, w: 395, h: 140 }
    ],
    scenarios: [
      { id: 'hi1', target: { kind: 'element', id: 'user' }, text: 'An attacker registers a lookalike domain and emails finance staff pretending to be the CFO, asking for an urgent change to a supplier’s bank details.', answer: 'S', why: 'The attacker is impersonating a trusted identity. Nothing in the system has been modified (not Tampering) and no data has leaked (not Information disclosure): the harm comes from trusting a forged identity.', refs: ['attack:T1566', 'attack:T1534', 'capec:151'] },
      { id: 'hi2', target: { kind: 'element', id: 'desk' }, text: 'A service-desk agent resets an executive’s MFA after a phone call. Later the executive insists they never asked, and nothing records who verified the caller or what was said.', answer: 'R', why: 'The core problem is the absence of reliable evidence: nobody can prove who did what. That is Repudiation. Spoofing may have happened too, but the missing audit trail is what lets everyone deny responsibility.', refs: ['nist-800-53:AU-10', 'attack:T1556'] },
      { id: 'hi3', target: { kind: 'flow', id: 'f2' }, text: 'On café Wi-Fi, a rogue access point proxies the sign-in flow and quietly captures session cookies after the user completes MFA.', answer: 'I', why: 'The attacker reads secrets (session tokens) flowing between the user and the identity provider. Using the stolen cookie afterwards is Spoofing, but the threat to this data flow is the exposure of its contents.', refs: ['attack:T1557', 'attack:T1539', 'attack:M1032'] },
      { id: 'hi4', target: { kind: 'element', id: 'idp' }, text: 'A compromised service-desk account abuses an over-permissive delegated admin role to add itself to Global Administrator.', answer: 'E', why: 'A low-privilege identity gains capabilities it was never granted. The attacker did not impersonate someone else (Spoofing) — they escalated within their own identity.', refs: ['attack:T1098', 'attack:T1078.004', 'attack:M1026'] },
      { id: 'hi5', target: { kind: 'element', id: 'docs' }, text: 'A SharePoint site shared with an “anyone with the link” policy is crawled and indexed, exposing board papers to the public internet.', answer: 'I', why: 'Confidential data held in the store becomes readable by people who are not authorised. No data was altered and no service was degraded.', refs: ['attack:T1213', 'attack:T1530', 'owasp-top10:A01'] },
      { id: 'hi6', target: { kind: 'flow', id: 'f6' }, text: 'An attacker on the network path modifies directory-synchronisation messages to slip a rogue account into a privileged group as it replicates.', answer: 'T', why: 'The data is altered in transit. The consequence is privilege escalation, but the threat applied to this data flow is unauthorised modification of its contents.', refs: ['attack:T1557', 'capec:94'] },
      { id: 'hi7', target: { kind: 'element', id: 'paw' }, text: 'Two administrators dispute who disabled a security group last week. Admins share one local administrator account and the workstation keeps no per-user session records.', answer: 'R', why: 'Actions cannot be attributed to individuals: the classic Repudiation threat. The remedy is individual accountable identities and tamper-resistant logs.', refs: ['nist-800-53:AU-3', 'nist-csf:PR.AA-01'] },
      { id: 'hi8', target: { kind: 'element', id: 'logs' }, text: 'After a verbose-logging change, the SIEM store fills its disk and silently starts dropping new events during a live incident.', answer: 'D', why: 'The store becomes unable to serve its purpose because capacity is exhausted. Nothing was forged, modified or disclosed — availability of the logging service is what failed.', refs: ['nist-csf:PR.IR-04', 'nist-800-53:AU-5'] }
    ]
  },
  {
    id: 'payroll-stack', name: 'Payroll, bank payments & backup',
    blurb: 'Payroll officers use a web portal in front of the payroll application and database. Payment files go to the bank; nightly backups stream to a repository.',
    elements: [
      { id: 'emp', type: 'external', label: 'Payroll officers & staff', x: 110, y: 280 },
      { id: 'portal', type: 'process', label: 'Payroll web portal', x: 320, y: 280 },
      { id: 'app', type: 'process', label: 'Payroll application', x: 530, y: 280 },
      { id: 'db', type: 'store', label: 'Payroll database', x: 740, y: 280 },
      { id: 'bank', type: 'external', label: 'Bank file gateway', x: 530, y: 110 },
      { id: 'bkp', type: 'process', label: 'Backup service', x: 740, y: 450 },
      { id: 'vault', type: 'store', label: 'Backup repository', x: 530, y: 450 }
    ],
    flows: [
      { id: 'f1', from: 'emp', to: 'portal', label: 'HTTPS requests' },
      { id: 'f2', from: 'portal', to: 'app', label: 'Session & API calls' },
      { id: 'f3', from: 'app', to: 'db', label: 'SQL queries' },
      { id: 'f4', from: 'app', to: 'bank', label: 'Payment files (ABA)' },
      { id: 'f5', from: 'db', to: 'bkp', label: 'Nightly backup stream' },
      { id: 'f6', from: 'bkp', to: 'vault', label: 'Backup copies' }
    ],
    boundaries: [
      { id: 'b1', label: 'Internet', x: 10, y: 20, w: 200, h: 520 },
      { id: 'b2', label: 'Corporate datacentre', x: 235, y: 225, w: 620, h: 325 }
    ],
    scenarios: [
      { id: 'pr1', target: { kind: 'element', id: 'portal' }, text: 'Attackers replay passwords leaked in an unrelated breach against the portal’s login and sign in as several payroll officers.', answer: 'S', why: 'The attacker authenticates as legitimate users by presenting stolen credentials. The login element is being fooled about who is calling; nothing is modified or exposed yet.', refs: ['attack:T1110.004', 'attack:T1078', 'owasp-top10:A07'] },
      { id: 'pr2', target: { kind: 'flow', id: 'f4' }, text: 'An attacker positioned on the file-transfer path swaps beneficiary account numbers in the payment file before it reaches the bank.', answer: 'T', why: 'Data is modified in transit to redirect funds. Spoofing would be impersonating the sender; here the content of the legitimate flow is altered.', refs: ['attack:T1565.002', 'attack:T1657', 'capec:94'] },
      { id: 'pr3', target: { kind: 'element', id: 'db' }, text: 'A reporting analyst exports the full payroll table, including tax-file numbers, to an unencrypted spreadsheet that is later lost on a train.', answer: 'I', why: 'Confidential records leave the data store to an unauthorised audience. The data was not altered, and availability was unaffected.', refs: ['attack:T1005', 'privacy:ndb', 'nist-800-53:SC-28'] },
      { id: 'pr4', target: { kind: 'element', id: 'app' }, text: 'A payroll clerk edits a request parameter so the application accepts their own pay variation as “approved”, bypassing maker-checker.', answer: 'E', why: 'A user performs an action their role never allowed. The clerk is not pretending to be someone else; the application failed to enforce authorisation.', refs: ['owasp-top10:A01', 'owasp-api:API5', 'attack:T1548'] },
      { id: 'pr5', target: { kind: 'element', id: 'bank' }, text: 'Payment files are delivered to a host that is never authenticated as the bank’s gateway; a fraudster stands up a lookalike endpoint and receives them.', answer: 'S', why: 'The system cannot tell the real bank from an impostor. This is entity impersonation, not interception of an authenticated session.', refs: ['attack:T1584', 'nist-800-53:IA-3', 'swift:csp'] },
      { id: 'pr6', target: { kind: 'flow', id: 'f1' }, text: 'On pay day a botnet floods the portal’s public endpoint with requests so legitimate payroll officers cannot submit their changes.', answer: 'D', why: 'Traffic on this flow is used to degrade the service for legitimate users. Nothing was altered or leaked.', refs: ['attack:T1498', 'attack:M1037', 'owasp-api:API4'] },
      { id: 'pr7', target: { kind: 'element', id: 'vault' }, text: 'An intruder with backup-admin rights silently alters older backup files so that restores would return corrupted payroll data.', answer: 'T', why: 'Stored data is modified without authority and without detection. It is not deletion (availability) or reading (confidentiality): integrity of the backups is what is being attacked.', refs: ['attack:T1565.001', 'attack:M1053', 'nist-800-53:SI-7'] },
      { id: 'pr8', target: { kind: 'element', id: 'bkp' }, text: 'The backup service runs under a shared service account, so restores of payroll data cannot be attributed to any individual.', answer: 'R', why: 'Sensitive operations are performed without accountable, attributable identity or evidence. The fix is named identities, approval and audit logging.', refs: ['nist-800-53:AU-10', 'nist-csf:PR.AA-01'] }
    ]
  }
];

export const ttx = [
  {
    id: 'ent-trojan-update', name: 'The Trojanised Update', blurb: 'A routine monitoring-platform update carries a hidden implant. Inspired by the documented SolarWinds Compromise (MITRE C0024). Detect it, decide under pressure, and keep your crown jewels.',
    adversary: { id: 'C0024', tier: 3 }, rounds: 8, maxScore: 260,
    injects: [
      { id: 'i1', round: 1, at: 'T+00:00', kind: 'ops', title: 'Routine vendor update applied', text: 'Change management approves a signed update to the network-monitoring platform. It deploys silently overnight.', fx: [] },
      { id: 'i2', round: 2, at: 'T+08:00', kind: 'alert', title: 'Odd DNS from the monitoring server', text: 'The SOC notices a monitoring server making low-volume DNS queries to an unfamiliar domain, on a regular beat.', fx: [{ op: 'intel', n: 1 }],
        decision: { prompt: 'What do you do first?', choices: [
          { id: 'a', quality: 'best', label: 'Isolate the server at the network layer, preserve memory and disk, and hunt for the same binary and beacon pattern elsewhere.', fx: [{ op: 'reveal', n: 2 }, { op: 'intel', n: 2 }], lesson: 'Contain without destroying evidence, then scope laterally: a single beacon is rarely the only foothold.', refs: ['nist:800-61', 'attack:T1071'] },
          { id: 'b', quality: 'good', label: 'Leave it online, capture traffic, and escalate to the IR retainer for advice.', fx: [{ op: 'intel', n: 1 }], lesson: 'Monitoring while it runs preserves visibility but gives the adversary more time.', refs: ['nist-csf:RS.MA-01'] },
          { id: 'c', quality: 'poor', label: 'Reboot the server and close the ticket as a false positive.', fx: [{ op: 'plant' }, { op: 'resilience', n: -3 }], lesson: 'Rebooting destroys volatile evidence and does nothing about persistence or lateral movement.', refs: ['nist:800-61'] }
        ] } },
      { id: 'i3', round: 3, at: 'T+16:00', kind: 'exec', title: 'The CEO’s phone is buzzing', text: 'A journalist has told the CEO that a security researcher claims your network was “backdoored”. The CEO wants a statement within the hour.', fx: [],
        decision: { prompt: 'How do you advise the CEO?', choices: [
          { id: 'a', quality: 'best', label: 'Hold a short factual holding statement with Legal and Comms, avoid speculation, and commit to updates as facts are confirmed.', fx: [{ op: 'shieldAll', n: 1 }, { op: 'score', n: 2 }], lesson: 'Say what you know, what you are doing and when you will update — never speculate about scope or attribution.', refs: ['nist-csf:RS.CO-02'] },
          { id: 'b', quality: 'ok', label: 'Say nothing until the investigation is complete.', fx: [], lesson: 'Silence cedes the narrative and can breach notification duties if affected people are not informed promptly.', refs: ['nist-csf:RS.CO-02'] },
          { id: 'c', quality: 'poor', label: 'Deny the claim publicly: the logs show nothing.', fx: [{ op: 'resilience', n: -4 }], lesson: 'Absence of evidence is not evidence of absence. A denial that later proves wrong is far costlier than a holding statement.', refs: ['nist:800-61'] }
        ] } },
      { id: 'i4', round: 4, at: 'T+24:00', kind: 'regulator', title: 'Is this a notifiable data breach?', text: 'Legal asks whether the Privacy Act’s Notifiable Data Breaches scheme applies: client files may have been accessed through the implant.', fx: [],
        decision: { prompt: 'What is the right approach?', choices: [
          { id: 'a', quality: 'best', label: 'Start a reasonable, expeditious NDB assessment now (it must finish within 30 days), and notify the OAIC and individuals as soon as practicable once an eligible breach is established.', fx: [{ op: 'score', n: 2 }], lesson: 'The 30 days is a maximum for the assessment, not a deadline to wait out. Assess immediately.', refs: ['privacy:ndb'] },
          { id: 'b', quality: 'ok', label: 'Wait until forensics has confirmed exactly which records were taken.', fx: [], lesson: 'You must act on reasonable grounds to suspect, not certainty.', refs: ['privacy:ndb'] },
          { id: 'c', quality: 'poor', label: 'Do not notify; there is no evidence yet of misuse.', fx: [{ op: 'resilience', n: -3 }], lesson: 'The test is likelihood of serious harm, not proof of misuse.', refs: ['privacy:ndb'] }
        ] } },
      { id: 'i5', round: 5, at: 'T+32:00', kind: 'vendor', title: 'The vendor calls', text: 'The software vendor confirms their build pipeline was compromised and asks you to “keep this quiet while we prepare a coordinated advisory”.', fx: [],
        decision: { prompt: 'How do you respond?', choices: [
          { id: 'a', quality: 'best', label: 'Request technical indicators and affected versions immediately, share findings with the ACSC and your sector peers, and keep your own obligations separate from the vendor’s timeline.', fx: [{ op: 'reveal', n: 1 }, { op: 'intel', n: 2 }], lesson: 'Third-party incidents do not pause your obligations. Sharing intelligence helps others find the same implant.', refs: ['nist-csf:GV.SC-08', 'attack:T1195.002'] },
          { id: 'b', quality: 'ok', label: 'Agree to wait for the vendor’s advisory.', fx: [], lesson: 'You lose valuable detection time waiting for someone else’s communications schedule.', refs: ['nist-csf:GV.SC-08'] },
          { id: 'c', quality: 'poor', label: 'Terminate the contract and stop all communication.', fx: [{ op: 'energyNext', n: -1 }], lesson: 'Cutting contact removes your best source of technical detail.', refs: ['nist-csf:GV.SC-10'] }
        ] } },
      { id: 'i6', round: 6, at: 'T+40:00', kind: 'ops', title: 'Restore Active Directory from last night?', text: 'The infrastructure lead proposes restoring the domain controllers from yesterday’s backup to “get rid of the intruder”.', fx: [],
        decision: { prompt: 'Your advice?', choices: [
          { id: 'a', quality: 'best', label: 'No. Assume the identity plane is compromised: plan a trusted rebuild, rotate privileged credentials (krbtgt twice) and verify backup integrity first.', fx: [{ op: 'reveal', n: 2 }, { op: 'shieldAll', n: 1 }], lesson: 'Backups taken after compromise restore the compromise. Rebuild trust deliberately.', refs: ['attack:T1558', 'nist-csf:RC.RP-03'] },
          { id: 'b', quality: 'poor', label: 'Yes — restore now.', fx: [{ op: 'plant' }], lesson: 'A restore may re-seed the adversary’s persistence and credentials.', refs: ['nist-csf:RC.RP-03'] },
          { id: 'c', quality: 'ok', label: 'Restore only the compromised server, leave AD alone.', fx: [], lesson: 'Partial measures leave stolen credentials valid.', refs: ['attack:T1078'] }
        ] } }
    ],
    objectives: [
      { id: 'o1', kind: 'detectBy', round: 4, text: 'Detect the intrusion by round 4 (T+24h)', points: 30 },
      { id: 'o2', kind: 'keepJewel', text: 'Keep every crown-jewel asset operational', points: 30 },
      { id: 'o3', kind: 'decisions', n: 3, text: 'Make at least 3 best-practice decisions under pressure', points: 30 },
      { id: 'o4', kind: 'resilienceAbove', n: 20, text: 'Finish with Resilience above 20', points: 20 },
      { id: 'o5', kind: 'win', text: 'Contain the operation', points: 20 }
    ]
  }
];
