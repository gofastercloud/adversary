// Reference resolver: "source:id" -> { label, url, kind }.
// Pure, dependency-free. Shared by the SPA, the validator and the API.

const OWASP_TOP10 = {
  A01: 'A01_2021-Broken_Access_Control', A02: 'A02_2021-Cryptographic_Failures', A03: 'A03_2021-Injection',
  A04: 'A04_2021-Insecure_Design', A05: 'A05_2021-Security_Misconfiguration',
  A06: 'A06_2021-Vulnerable_and_Outdated_Components', A07: 'A07_2021-Identification_and_Authentication_Failures',
  A08: 'A08_2021-Software_and_Data_Integrity_Failures', A09: 'A09_2021-Security_Logging_and_Monitoring_Failures',
  A10: 'A10_2021-Server-Side_Request_Forgery_%28SSRF%29'
};
const OWASP_API = {
  API1: '0xa1-broken-object-level-authorization', API2: '0xa2-broken-authentication',
  API3: '0xa3-broken-object-property-level-authorization', API4: '0xa4-unrestricted-resource-consumption',
  API5: '0xa5-broken-function-level-authorization', API6: '0xa6-unrestricted-access-to-sensitive-business-flows',
  API7: '0xa7-server-side-request-forgery', API8: '0xa8-security-misconfiguration',
  API9: '0xa9-improper-inventory-management', API10: '0xaa-unsafe-consumption-of-apis'
};
const OWASP_LLM = {
  LLM01: 'llm01-prompt-injection', LLM02: 'llm022025-sensitive-information-disclosure', LLM03: 'llm032025-supply-chain',
  LLM04: 'llm042025-data-and-model-poisoning', LLM05: 'llm052025-improper-output-handling',
  LLM06: 'llm062025-excessive-agency', LLM07: 'llm072025-system-prompt-leakage',
  LLM08: 'llm082025-vector-and-embedding-weaknesses', LLM09: 'llm092025-misinformation',
  LLM10: 'llm102025-unbounded-consumption'
};
const OWASP_MISC = {
  asvs: ['OWASP ASVS', 'https://owasp.org/www-project-application-security-verification-standard/'],
  samm: ['OWASP SAMM', 'https://owasp.org/www-project-samm/'],
  'threat-dragon': ['OWASP Threat Dragon', 'https://owasp.org/www-project-threat-dragon/'],
  'threat-modeling-manifesto': ['Threat Modeling Manifesto', 'https://www.threatmodelingmanifesto.org/'],
  cheatsheets: ['OWASP Cheat Sheet Series', 'https://cheatsheetseries.owasp.org/'],
  devsecops: ['OWASP DevSecOps Guideline', 'https://owasp.org/www-project-devsecops-guideline/'],
  mas: ['OWASP MAS', 'https://mas.owasp.org/']
};
const NIST_PUBS = {
  '800-30': ['SP 800-30 Rev.1', 'https://csrc.nist.gov/pubs/sp/800/30/r1/final'],
  '800-37': ['SP 800-37 Rev.2', 'https://csrc.nist.gov/pubs/sp/800/37/r2/final'],
  '800-39': ['SP 800-39', 'https://csrc.nist.gov/pubs/sp/800/39/final'],
  '800-61': ['SP 800-61 Rev.3', 'https://csrc.nist.gov/pubs/sp/800/61/r3/final'],
  '800-82': ['SP 800-82 Rev.3', 'https://csrc.nist.gov/pubs/sp/800/82/r3/final'],
  '800-160v2': ['SP 800-160 Vol.2', 'https://csrc.nist.gov/pubs/sp/800/160/v2/r1/final'],
  '800-161': ['SP 800-161 Rev.1', 'https://csrc.nist.gov/pubs/sp/800/161/r1/final'],
  '800-171': ['SP 800-171 Rev.3', 'https://csrc.nist.gov/pubs/sp/800/171/r3/final'],
  '800-207': ['SP 800-207 Zero Trust', 'https://csrc.nist.gov/pubs/sp/800/207/final'],
  '800-218': ['SP 800-218 SSDF', 'https://csrc.nist.gov/pubs/sp/800/218/final'],
  '800-63': ['SP 800-63-4 Digital Identity', 'https://csrc.nist.gov/pubs/sp/800/63/4/final'],
  'fips-203': ['FIPS 203 (ML-KEM)', 'https://csrc.nist.gov/pubs/fips/203/final'],
  'fips-204': ['FIPS 204 (ML-DSA)', 'https://csrc.nist.gov/pubs/fips/204/final'],
  'fips-205': ['FIPS 205 (SLH-DSA)', 'https://csrc.nist.gov/pubs/fips/205/final'],
  'ir-8547': ['IR 8547 PQC Transition', 'https://csrc.nist.gov/pubs/ir/8547/ipd']
};
const E8 = {
  'app-control': 'Application control', 'patch-apps': 'Patch applications', macros: 'Restrict Office macros',
  hardening: 'User application hardening', 'restrict-admin': 'Restrict admin privileges', 'patch-os': 'Patch operating systems',
  mfa: 'Multi-factor authentication', backups: 'Regular backups', 'maturity-model': 'Maturity model'
};
const E8_URL = 'https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight';

/** Sources whose id is free-form: [label prefix, landing url]. */
const LANDING = {
  aescsf: ['AESCSF', 'https://www.aemo.com.au/initiatives/major-programs/cyber-security/aescsf-framework-and-resources'],
  soci: ['SOCI Act', 'https://www.legislation.gov.au/C2018A00029/latest/text'],
  apra: ['APRA', 'https://www.apra.gov.au/operational-risk-management'],
  iso27001: ['ISO 27001', 'https://www.iso.org/standard/27001'],
  cis: ['CIS Control', 'https://www.cisecurity.org/controls'],
  pci: ['PCI DSS', 'https://www.pcisecuritystandards.org/document_library/'],
  swift: ['SWIFT CSP', 'https://www.swift.com/myswift/customer-security-programme-csp'],
  cloud: ['Cloud', 'https://aws.amazon.com/compliance/shared-responsibility-model/'],
  stride: ['STRIDE', 'https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats'],
  purdue: ['Purdue Model', 'https://www.isa.org/'],
  ism: ['ASD ISM', 'https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/ism'],
  cisa: ['CISA', 'https://www.cisa.gov/securebydesign'],
  privacy: ['Privacy Act', 'https://www.oaic.gov.au/privacy/notifiable-data-breaches']
};

const CTID_SETS = { nist: 'NIST SP 800-53 → ATT&CK', aws: 'AWS security services → ATT&CK', azure: 'Azure security controls → ATT&CK', gcp: 'GCP security controls → ATT&CK', m365: 'Microsoft 365 → ATT&CK', cis: 'CIS Controls → ATT&CK', kev: 'CISA KEV → ATT&CK', veris: 'VERIS → ATT&CK', csa_ccm: 'CSA CCM → ATT&CK', cri_profile: 'CRI Profile → ATT&CK' };

const RE = {
  attack: /^(T\d{4}(\.\d{3})?|M\d{4}|TA\d{4}|G\d{4}|S\d{4}|C\d{4}|DS\d{4}|A\d{4})$/,
  ics: /^(T0\d{3}|M0\d{3}|TA0\d{3}|G0\d{3}|S0\d{3})$/,
  nistCsf: /^(overview|[A-Z]{2}(\.[A-Z]{2}(-\d{2})?)?)$/,
  nist80053: /^[A-Z]{2}-\d{1,2}(\(\d{1,2}\))?$/
};

export const REF_SOURCES = ['attack', 'ics', 'emb3d', 'ctid', 'd3fend', 'capec', 'cwe', 'owasp-top10', 'owasp-api', 'owasp-llm', 'owasp',
  'nist-csf', 'nist-800-53', 'nist', 'e8', 'iec62443', ...Object.keys(LANDING)];

/** Parse + resolve. Returns null when malformed/unknown (validator reports it). */
export function resolveRef(ref) {
  if (typeof ref !== 'string') return null;
  const i = ref.indexOf(':');
  if (i < 1) return null;
  const src = ref.slice(0, i);
  const id = ref.slice(i + 1);
  if (!id) return null;
  switch (src) {
    case 'attack': {
      if (!RE.attack.test(id)) return null;
      const t = id[0] === 'T' && id[1] !== 'A' ? 'techniques' : id[0] === 'M' ? 'mitigations' : id.startsWith('TA') ? 'tactics' : id[0] === 'G' ? 'groups' : id[0] === 'S' ? 'software' : id[0] === 'C' ? 'campaigns' : id[0] === 'A' ? 'assets' : 'datasources';
      return { label: `ATT&CK ${id}`, url: `https://attack.mitre.org/${t}/${id.replace('.', '/')}/`, kind: 'mitre' };
    }
    case 'ics': {
      if (!RE.ics.test(id)) return null;
      const t = id.startsWith('TA') ? 'tactics' : id[0] === 'M' ? 'mitigations' : id[0] === 'T' ? 'techniques' : id[0] === 'G' ? 'groups' : 'software';
      return { label: `ICS ${id}`, url: `https://attack.mitre.org/${t}/${id}/`, kind: 'mitre' };
    }
    case 'emb3d': {
      const m = /^(TID|MID)-(\d{3})$|^PID-(\d{1,3})$/.exec(id); if (!m) return null;
      const kind = id.startsWith('TID') ? 'threats' : id.startsWith('MID') ? 'mitigations' : 'properties';
      return { label: `EMB3D ${id}`, url: kind === 'properties' ? 'https://emb3d.mitre.org/properties-list/' : `https://emb3d.mitre.org/${kind}/${id}`, kind: 'mitre' };
    }
    case 'ctid': return CTID_SETS[id] ? { label: `CTID Mappings: ${CTID_SETS[id]}`, url: `https://ctid.mitre.org/mappings/external/${id}/`, kind: 'mitre' } : null;
    case 'd3fend': return { label: `D3FEND ${id}`, url: `https://d3fend.mitre.org/technique/d3f:${id}/`, kind: 'mitre' };
    case 'capec': return /^\d+$/.test(id) ? { label: `CAPEC-${id}`, url: `https://capec.mitre.org/data/definitions/${id}.html`, kind: 'mitre' } : null;
    case 'cwe': return /^\d+$/.test(id) ? { label: `CWE-${id}`, url: `https://cwe.mitre.org/data/definitions/${id}.html`, kind: 'mitre' } : null;
    case 'owasp-top10': return OWASP_TOP10[id] ? { label: `OWASP ${id}:2021`, url: `https://owasp.org/Top10/${OWASP_TOP10[id]}/`, kind: 'owasp' } : null;
    case 'owasp-api': return OWASP_API[id] ? { label: `OWASP ${id}:2023`, url: `https://owasp.org/API-Security/editions/2023/en/${OWASP_API[id]}/`, kind: 'owasp' } : null;
    case 'owasp-llm': return OWASP_LLM[id] ? { label: `OWASP ${id}:2025`, url: `https://genai.owasp.org/llmrisk/${OWASP_LLM[id]}/`, kind: 'owasp' } : null;
    case 'owasp': return OWASP_MISC[id] ? { label: OWASP_MISC[id][0], url: OWASP_MISC[id][1], kind: 'owasp' } : null;
    case 'nist-csf': {
      if (!RE.nistCsf.test(id)) return null;
      if (id === 'overview') return { label: 'NIST CSF 2.0', url: 'https://www.nist.gov/cyberframework', kind: 'nist' };
      return { label: `CSF 2.0 ${id}`, url: `https://csrc.nist.gov/projects/cprt/catalog#/cprt/framework/version/CSF_2_0_0/home?element=${id}`, kind: 'nist' };
    }
    case 'nist-800-53':
      return RE.nist80053.test(id) ? { label: `800-53 ${id}`, url: `https://csrc.nist.gov/projects/cprt/catalog#/cprt/framework/version/SP_800_53_5_1_1/home?element=${encodeURIComponent(id)}`, kind: 'nist' } : null;
    case 'nist': return NIST_PUBS[id] ? { label: `NIST ${NIST_PUBS[id][0]}`, url: NIST_PUBS[id][1], kind: 'nist' } : null;
    case 'e8': return E8[id] ? { label: `Essential Eight: ${E8[id]}`, url: E8_URL, kind: 'au' } : null;
    case 'iec62443': return /^(overview|\d-\d)$/.test(id) ? { label: id === 'overview' ? 'IEC 62443' : `IEC 62443-${id}`, url: 'https://www.isa.org/standards-and-publications/isa-standards/isa-iec-62443-series-of-standards', kind: 'std' } : null;
    default: {
      const l = LANDING[src];
      if (!l || !/^[\w .\-/()]+$/.test(id)) return null;
      const kind = ['aescsf', 'soci', 'apra', 'ism', 'privacy'].includes(src) ? 'au' : 'std';
      return { label: id === 'overview' ? l[0] : `${l[0]} ${id}`, url: l[1], kind };
    }
  }
}

export const CTID_IDS = Object.keys(CTID_SETS);
export const ATTACK_ID_RE = RE.attack;
export const ICS_ID_RE = RE.ics;
export const E8_IDS = Object.keys(E8);
export const OWASP_IDS = { 'owasp-top10': Object.keys(OWASP_TOP10), 'owasp-api': Object.keys(OWASP_API), 'owasp-llm': Object.keys(OWASP_LLM), owasp: Object.keys(OWASP_MISC) };
export const NIST_PUB_IDS = Object.keys(NIST_PUBS);
