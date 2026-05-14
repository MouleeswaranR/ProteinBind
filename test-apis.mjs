/**
 * API Test Script — Full property exploration
 * PubChem Similarity Search & NVIDIA MolMIM Generate
 * Run: node test-apis.mjs
 * With MolMIM: $env:NVIDIA_API_KEY="nvapi-xxxx" ; node test-apis.mjs
 */

const TEST_SMILES   = "CC(=O)OC1=CC=CC=C1C(O)=O"; // Aspirin
const NUM_MOLECULES = 5;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";

// All PubChem computed properties available via REST API
const PUBCHEM_ALL_PROPERTIES = [
  "MolecularFormula",
  "MolecularWeight",
  "CanonicalSMILES",
  "IsomericSMILES",
  "InChI",
  "InChIKey",
  "IUPACName",
  "XLogP",
  "ExactMass",
  "MonoisotopicMass",
  "TPSA",
  "Complexity",
  "Charge",
  "HBondDonorCount",
  "HBondAcceptorCount",
  "RotatableBondCount",
  "HeavyAtomCount",
  "CovalentUnitCount",
  "IsotopeAtomCount",
  "AtomStereoCount",
  "DefinedAtomStereoCount",
  "UndefinedAtomStereoCount",
  "BondStereoCount",
  "DefinedBondStereoCount",
  "UndefinedBondStereoCount",
].join(",");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function section(title) {
  console.log("\n" + "═".repeat(70));
  console.log(`  ${title}`);
  console.log("═".repeat(70));
}

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

// Fetch ALL PubChem properties for a list of SMILES (one POST per SMILES)
async function fetchAllPubChemProps(smilesList) {
  return Promise.all(
    smilesList.map(async (smiles, i) => {
      try {
        const res = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/property/${PUBCHEM_ALL_PROPERTIES}/JSON`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `smiles=${encodeURIComponent(smiles)}`,
          }
        );
        if (!res.ok) return { smiles, error: `HTTP ${res.status}` };
        const data = await res.json();
        return { smiles, ...(data.PropertyTable?.Properties?.[0] || {}) };
      } catch (e) {
        return { smiles, error: e.message };
      }
    })
  );
}

// ─── 1. PubChem Similarity Search ─────────────────────────────────────────────

async function testPubChem() {
  section("PubChem fastsimilarity_2d — POST + ALL properties");

  // Step 1: get similar CIDs
  const searchRes = await fetch(
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastsimilarity_2d/smiles/cids/JSON?MaxRecords=${NUM_MOLECULES}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `smiles=${encodeURIComponent(TEST_SMILES)}`,
    }
  );
  const searchData = await searchRes.json();
  console.log("[PubChem] CID search status:", searchRes.status);

  const cids = searchData.IdentifierList?.CID;
  if (!cids || cids.length === 0) { console.log("[PubChem] ⚠  No CIDs found."); return null; }
  console.log("[PubChem] CIDs found:", cids.join(", "));

  // Step 2: fetch ALL properties for those CIDs in one request
  const propRes = await fetch(
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cids.join(",")}/property/${PUBCHEM_ALL_PROPERTIES}/JSON`
  );
  const propData = await propRes.json();
  const properties = propData.PropertyTable?.Properties || [];

  console.log(`\n[PubChem] ✓ Full properties for ${properties.length} similar molecules:`);
  properties.forEach((mol, i) => {
    const smiles = mol.CanonicalSMILES || mol.IsomericSMILES || mol.SMILES || mol.ConnectivitySMILES || "—";
    console.log(`\n── Molecule ${i + 1} ──────────────────────────────`);
    console.log(`  CID               : ${mol.CID}`);
    console.log(`  SMILES            : ${smiles}`);
    console.log(`  IUPAC Name        : ${mol.IUPACName || "—"}`);
    console.log(`  Molecular Formula : ${mol.MolecularFormula || "—"}`);
    console.log(`  Molecular Weight  : ${mol.MolecularWeight || "—"} g/mol`);
    console.log(`  Exact Mass        : ${mol.ExactMass || "—"}`);
    console.log(`  InChIKey          : ${mol.InChIKey || "—"}`);
    console.log(`  XLogP             : ${mol.XLogP ?? "—"}  (lipophilicity)`);
    console.log(`  TPSA              : ${mol.TPSA ?? "—"} Å²  (polar surface area)`);
    console.log(`  Complexity        : ${mol.Complexity ?? "—"}`);
    console.log(`  H-Bond Donors     : ${mol.HBondDonorCount ?? "—"}`);
    console.log(`  H-Bond Acceptors  : ${mol.HBondAcceptorCount ?? "—"}`);
    console.log(`  Rotatable Bonds   : ${mol.RotatableBondCount ?? "—"}`);
    console.log(`  Heavy Atoms       : ${mol.HeavyAtomCount ?? "—"}`);
    console.log(`  Charge            : ${mol.Charge ?? "—"}`);
    console.log(`  Stereo Centers    : ${mol.AtomStereoCount ?? "—"}`);
    const mw = parseFloat(mol.MolecularWeight);
    const logP = mol.XLogP;
    const hbd = mol.HBondDonorCount;
    const hba = mol.HBondAcceptorCount;
    if (mw && logP != null && hbd != null && hba != null) {
      const pass = mw <= 500 && logP <= 5 && hbd <= 5 && hba <= 10;
      console.log(`  Lipinski Ro5      : ${pass ? "✓ PASS" : "✗ FAIL"}  (MW≤500, LogP≤5, HBD≤5, HBA≤10)`);
    }
  });

  if (properties.length > 0) {
    console.log("\n[PubChem] All available keys:", Object.keys(properties[0]).join(", "));
  }

  return properties;
}

// ─── 2. NVIDIA MolMIM + full PubChem enrichment ───────────────────────────────

async function testNvidiaMolMIM() {
  section("NVIDIA MolMIM — POST + full PubChem enrichment");

  if (!NVIDIA_API_KEY) {
    console.log("[MolMIM] ⚠  NVIDIA_API_KEY not set — skipping.");
    return null;
  }
  console.log("[MolMIM] API key:", NVIDIA_API_KEY.slice(0, 12) + "…");

  const res = await fetch(
    "https://health.api.nvidia.com/v1/biology/nvidia/molmim/generate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
        Accept: "application/json",
      },
      body: JSON.stringify({
        smi: TEST_SMILES,
        num_molecules: NUM_MOLECULES,
        iterations: 10,
        min_similarity: 0.3,
      }),
    }
  );

  console.log("[MolMIM] HTTP status:", res.status);
  const data = await res.json();
  console.log("[MolMIM] Raw response:\n", pretty(data));
  console.log("[MolMIM] score_type:", data.score_type);

  let rawMolecules = data.molecules;
  if (typeof rawMolecules === "string") rawMolecules = JSON.parse(rawMolecules);
  if (!Array.isArray(rawMolecules)) { console.log("[MolMIM] ✗ No molecules array."); return null; }

  const smilesList = rawMolecules.map((m) => m.sample || m.smiles || "").filter(Boolean);
  console.log(`\n[MolMIM] Generated ${smilesList.length} SMILES (raw):`);
  smilesList.forEach((s, i) => console.log(`  ${i + 1}. ${s}  QED=${rawMolecules[i].score?.toFixed(6)}`));

  // Enrich with ALL PubChem properties
  section("PubChem enrichment — ALL properties for MolMIM results");
  console.log("Querying PubChem for full property set of each generated molecule...\n");

  const enriched = await fetchAllPubChemProps(smilesList);

  enriched.forEach((mol, i) => {
    console.log(`\n── MolMIM Molecule ${i + 1} ──────────────────────────────`);
    console.log(`  SMILES (MolMIM)   : ${smilesList[i]}`);
    console.log(`  QED Score         : ${rawMolecules[i].score?.toFixed(6)}  (score_type: ${data.score_type})`);
    if (mol.error) {
      console.log(`  PubChem lookup    : ✗ ${mol.error}  (novel molecule not in PubChem DB)`);
    } else {
      console.log(`  CID               : ${mol.CID || "—"}`);
      console.log(`  IUPAC Name        : ${mol.IUPACName || "—"}`);
      console.log(`  Molecular Formula : ${mol.MolecularFormula || "—"}`);
      console.log(`  Molecular Weight  : ${mol.MolecularWeight || "—"} g/mol`);
      console.log(`  Exact Mass        : ${mol.ExactMass || "—"}`);
      console.log(`  InChIKey          : ${mol.InChIKey || "—"}`);
      console.log(`  XLogP             : ${mol.XLogP ?? "—"}  (lipophilicity)`);
      console.log(`  TPSA              : ${mol.TPSA ?? "—"} Å²  (polar surface area)`);
      console.log(`  Complexity        : ${mol.Complexity ?? "—"}`);
      console.log(`  H-Bond Donors     : ${mol.HBondDonorCount ?? "—"}`);
      console.log(`  H-Bond Acceptors  : ${mol.HBondAcceptorCount ?? "—"}`);
      console.log(`  Rotatable Bonds   : ${mol.RotatableBondCount ?? "—"}`);
      console.log(`  Heavy Atoms       : ${mol.HeavyAtomCount ?? "—"}`);
      console.log(`  Charge            : ${mol.Charge ?? "—"}`);
      console.log(`  Stereo Centers    : ${mol.AtomStereoCount ?? "—"}`);
      const mw = parseFloat(mol.MolecularWeight);
      const logP = mol.XLogP;
      const hbd = mol.HBondDonorCount;
      const hba = mol.HBondAcceptorCount;
      if (mw && logP != null && hbd != null && hba != null) {
        const pass = mw <= 500 && logP <= 5 && hbd <= 5 && hba <= 10;
        console.log(`  Lipinski Ro5      : ${pass ? "✓ PASS" : "✗ FAIL"}  (MW≤500, LogP≤5, HBD≤5, HBA≤10)`);
      }
    }
  });

  return enriched;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log("Test SMILES :", TEST_SMILES, " (Aspirin)");
  console.log("Num molecules:", NUM_MOLECULES);

  const pubchemMols  = await testPubChem();
  const molmimResult = await testNvidiaMolMIM();

  section("Summary");
  if (pubchemMols) {
    const keys = Object.keys(pubchemMols[0]).filter(k => k !== "CID").join(", ");
    console.log(`PubChem  : ✓ ${pubchemMols.length} molecules`);
    console.log(`           Properties: ${keys}`);
  } else {
    console.log("PubChem  : ✗ failed");
  }
  console.log("MolMIM   :", molmimResult ? `✓ ${molmimResult.length} molecules enriched with PubChem` : "✗ failed / skipped");
  console.log();
})();
