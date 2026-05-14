// app/api/molecule-generation/route.ts

import { NextResponse } from 'next/server';

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || process.env.NEXT_PUBLIC_NVIDIA_API_KEY || '';

const PUBCHEM_PROPS = [
  'MolecularFormula', 'MolecularWeight', 'CanonicalSMILES', 'IsomericSMILES',
  'InChIKey', 'IUPACName', 'XLogP', 'ExactMass',
  'TPSA', 'Complexity', 'Charge',
  'HBondDonorCount', 'HBondAcceptorCount',
  'RotatableBondCount', 'HeavyAtomCount',
].join(',');

// Map a PubChem property object → our molecule shape
function mapPubChemProps(prop: any, score = 0.85) {
  const smiles = prop.CanonicalSMILES || prop.IsomericSMILES || prop.SMILES || prop.ConnectivitySMILES;
  if (!smiles) return null;
  return {
    smiles,
    name:        prop.IUPACName       || `CID ${prop.CID}`,
    formula:     prop.MolecularFormula || '',
    weight:      parseFloat(prop.MolecularWeight) || 0,
    exactMass:   parseFloat(prop.ExactMass)       || 0,
    score,
    xlogp:       prop.XLogP           ?? null,
    tpsa:        prop.TPSA             ?? null,
    hbd:         prop.HBondDonorCount  ?? null,
    hba:         prop.HBondAcceptorCount ?? null,
    rotBonds:    prop.RotatableBondCount ?? null,
    heavyAtoms:  prop.HeavyAtomCount   ?? null,
    complexity:  prop.Complexity       ?? null,
    inchikey:    prop.InChIKey         || '',
  };
}

// ── Fetch full PubChem properties for a SMILES (POST by SMILES) ───────────────
async function fetchPubChemBySMILES(smiles: string): Promise<any | null> {
  try {
    const res = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/property/${PUBCHEM_PROPS}/JSON`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `smiles=${encodeURIComponent(smiles)}`,
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.PropertyTable?.Properties?.[0] || null;
  } catch {
    return null;
  }
}

// ── NVIDIA MolMIM ──────────────────────────────────────────────────────────────
async function generateWithMolMIM(inputSmiles: string, numMolecules: number) {
  const res = await fetch(
    'https://health.api.nvidia.com/v1/biology/nvidia/molmim/generate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({ smi: inputSmiles, num_molecules: numMolecules, iterations: 10, min_similarity: 0.3 }),
    }
  );

  if (!res.ok) { console.error('[MolMIM] Error', res.status, await res.text()); return null; }

  const data = await res.json();
  let raw: any[] = data.molecules;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return null; } }
  if (!Array.isArray(raw)) return null;

  // Enrich each SMILES with full PubChem properties (novel molecules may return null)
  const enriched = await Promise.all(
    raw.map(async (m: any) => {
      const smiles = m.sample || m.smiles || '';
      if (!smiles) return null;
      const qedScore = m.score ?? 0;
      const pubchem = await fetchPubChemBySMILES(smiles);
      if (pubchem) {
        return mapPubChemProps({ ...pubchem }, qedScore);
      }
      // Novel molecule — return SMILES + score only; RDKit will compute props client-side
      return { smiles, name: '', formula: '', weight: 0, exactMass: 0, score: qedScore,
               xlogp: null, tpsa: null, hbd: null, hba: null, rotBonds: null,
               heavyAtoms: null, complexity: null, inchikey: '' };
    })
  );

  return enriched.filter(Boolean);
}

// ── PubChem similarity search ──────────────────────────────────────────────────
async function generateWithPubChem(inputSmiles: string, numMolecules: number) {
  const searchRes = await fetch(
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastsimilarity_2d/smiles/cids/JSON?MaxRecords=${numMolecules}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `smiles=${encodeURIComponent(inputSmiles)}`,
    }
  );
  if (!searchRes.ok) return null;
  const searchData = await searchRes.json();
  const cids: number[] = searchData.IdentifierList?.CID;
  if (!cids || cids.length === 0) return [];

  const propRes = await fetch(
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cids.join(',')}/property/${PUBCHEM_PROPS}/JSON`
  );
  if (!propRes.ok) return null;
  const propData = await propRes.json();

  return (propData.PropertyTable?.Properties || [])
    .map((prop: any) => mapPubChemProps(prop, 0.85))
    .filter(Boolean);
}

// ── Route handler ──────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const inputSmiles = body.skeletons?.[0] || body.smiles;
    const numMolecules = body.num_molecules || 5;

    if (!inputSmiles) {
      return NextResponse.json({ error: 'Missing input SMILES' }, { status: 400 });
    }

    let molecules: any[] | null = null;
    let source = 'molmim';

    if (NVIDIA_API_KEY) {
      molecules = await generateWithMolMIM(inputSmiles, numMolecules);
    }

    if (!molecules || molecules.length === 0) {
      source = 'pubchem';
      molecules = await generateWithPubChem(inputSmiles, numMolecules);
    }

    if (!molecules) {
      return NextResponse.json({ error: 'Both MolMIM and PubChem failed to return molecules' }, { status: 502 });
    }

    console.log(`[molecule-generation] source=${source} count=${molecules.length}`);
    return NextResponse.json({ molecules, source });

  } catch (error: any) {
    console.error('[molecule-generation] Internal error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
