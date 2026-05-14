// app/api/molecule-generation/route.ts

import { NextResponse } from 'next/server';

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || process.env.NEXT_PUBLIC_NVIDIA_API_KEY || '';

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
      body: JSON.stringify({
        smi: inputSmiles,
        num_molecules: numMolecules,
        iterations: 10,
        min_similarity: 0.3,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('[MolMIM] Error', res.status, err);
    return null;
  }

  const data = await res.json();

  // molecules is returned as a JSON *string* by NIM MolMIM
  let raw: any[] = data.molecules;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return null; }
  }
  if (!Array.isArray(raw)) return null;

  // Enrich each SMILES with IUPAC name + weight from PubChem
  const enriched = await Promise.all(
    raw.map(async (m: any) => {
      const smiles = m.sample || m.smiles || '';
      if (!smiles) return null;
      const name = await fetchIUPACName(smiles);
      return { smiles, name: name.iupac || '', weight: name.weight || 0, score: m.score ?? 0 };
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
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cids.join(',')}/property/CanonicalSMILES,IsomericSMILES,IUPACName,MolecularWeight/JSON`
  );
  if (!propRes.ok) return null;
  const propData = await propRes.json();
  const properties: any[] = propData.PropertyTable?.Properties || [];

  return properties
    .map((prop: any) => {
      const smiles =
        prop.CanonicalSMILES || prop.IsomericSMILES || prop.SMILES || prop.ConnectivitySMILES;
      if (!smiles) return null;
      return { smiles, name: prop.IUPACName || `CID ${prop.CID}`, weight: prop.MolecularWeight || 0, score: 0.85 };
    })
    .filter(Boolean);
}

// ── PubChem IUPAC name lookup ──────────────────────────────────────────────────
async function fetchIUPACName(smiles: string): Promise<{ iupac: string; weight: number }> {
  try {
    const res = await fetch(
      'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/property/IUPACName,MolecularWeight/JSON',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `smiles=${encodeURIComponent(smiles)}`,
      }
    );
    if (!res.ok) return { iupac: '', weight: 0 };
    const data = await res.json();
    const props = data.PropertyTable?.Properties?.[0];
    return { iupac: props?.IUPACName || '', weight: parseFloat(props?.MolecularWeight) || 0 };
  } catch {
    return { iupac: '', weight: 0 };
  }
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

    console.log('[molecule-generation] Input:', { inputSmiles, numMolecules });

    // Try MolMIM first (uses NVIDIA API key), fall back to PubChem
    let molecules: any[] | null = null;
    let source = 'molmim';

    if (NVIDIA_API_KEY) {
      console.log('[molecule-generation] Trying MolMIM...');
      molecules = await generateWithMolMIM(inputSmiles, numMolecules);
    }

    if (!molecules || molecules.length === 0) {
      console.log('[molecule-generation] Falling back to PubChem...');
      source = 'pubchem';
      molecules = await generateWithPubChem(inputSmiles, numMolecules);
    }

    if (!molecules) {
      return NextResponse.json({ error: 'Both MolMIM and PubChem failed to return molecules' }, { status: 502 });
    }

    console.log(`[molecule-generation] Source: ${source}, molecules: ${molecules.length}`);
    return NextResponse.json({ molecules, source });

  } catch (error: any) {
    console.error('[molecule-generation] Internal error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
