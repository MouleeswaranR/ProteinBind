/**
 * Computes cheminformatics properties for a SMILES string using the RDKit
 * WebAssembly module (already loaded by MoleculeStructure components).
 *
 * Returns null if RDKit is unavailable or the SMILES is invalid.
 */

export interface ComputedMolProps {
  formula:    string;
  weight:     number;
  exactMass:  number;
  xlogp:      number;
  tpsa:       number;
  hbd:        number;
  hba:        number;
  rotBonds:   number;
  heavyAtoms: number;
  complexity: number | null;
  inchikey:   string;
  lipinskiPass: boolean;
}

let rdkitInstance: any = null;

async function getRDKit(): Promise<any | null> {
  if (rdkitInstance) return rdkitInstance;
  try {
    if (typeof window !== 'undefined' && (window as any).initRDKitModule) {
      rdkitInstance = await (window as any).initRDKitModule();
    } else {
      const mod = await import('@rdkit/rdkit');
      // The package may export initRDKitModule as default or as named export
      const initFn = (mod as any).default || (mod as any).initRDKitModule || mod;
      rdkitInstance = await initFn();
    }
    return rdkitInstance;
  } catch {
    return null;
  }
}

export async function computeMolProps(smiles: string): Promise<ComputedMolProps | null> {
  if (!smiles) return null;
  const RDKit = await getRDKit();
  if (!RDKit) return null;

  let mol: any = null;
  try {
    mol = RDKit.get_mol(smiles);
    if (!mol || !mol.is_valid()) return null;

    const desc: any = JSON.parse(mol.get_descriptors());

    // InChIKey
    let inchikey = '';
    try { inchikey = mol.get_inchikey(); } catch { inchikey = ''; }

    // Molecular formula — derive from RDKit descriptors
    // (amw = average mol weight, exactmw = exact mass)
    const weight    = desc.amw           ?? 0;
    const exactMass = desc.exactmw       ?? 0;
    const xlogp     = desc.CrippenClogP  ?? desc.MolLogP ?? 0;
    const tpsa      = desc.tpsa          ?? 0;
    const hbd       = desc.lipinskiHBD   ?? desc.NumHBD ?? 0;
    const hba       = desc.lipinskiHBA   ?? desc.NumHBA ?? 0;
    const rotBonds  = desc.NumRotatableBonds ?? 0;
    const heavyAtoms = desc.HeavyAtomCount   ?? 0;

    // Lipinski Rule of 5
    const lipinskiPass = weight <= 500 && xlogp <= 5 && hbd <= 5 && hba <= 10;

    // Molecular formula — not directly in descriptors; derive from InChI layer
    let formula = '';
    try {
      const inchi = mol.get_inchi();
      const match = inchi?.match(/InChI=1S\/([^/]+)/);
      if (match) formula = match[1];
    } catch { formula = ''; }

    return {
      formula,
      weight:      parseFloat(weight.toFixed(3)),
      exactMass:   parseFloat(exactMass.toFixed(6)),
      xlogp:       parseFloat(xlogp.toFixed(2)),
      tpsa:        parseFloat(tpsa.toFixed(1)),
      hbd,
      hba,
      rotBonds,
      heavyAtoms,
      complexity:  null, // not available in RDKit JS descriptors
      inchikey,
      lipinskiPass,
    };
  } catch {
    return null;
  } finally {
    mol?.delete();
  }
}
