"use client";
import React, { useState, useEffect, useCallback } from "react";
import MoleculeStructure from "../MoleculeStructure/index";
import { useUser } from "@/app/context/UserContext";
import { getMoleculeGenerationHistoryByUser } from "@/lib/actions/molecule-generation.action";
import { computeMolProps, ComputedMolProps } from "@/lib/utils/molprops";

const staticMoleculeBank = [
  {
    moleculeName: "Aspirin",
    smilesStructure: "CC(=O)OC1=CC=CC=C1C(O)=O",
    molecularWeight: 180.16,
    categoryUsage: "Pain reliever/NSAID",
  },
  {
    moleculeName: "Caffeine",
    smilesStructure: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
    molecularWeight: 194.19,
    categoryUsage: "Stimulant",
  },
  {
    moleculeName: "Benzene",
    smilesStructure: "C1=CC=CC=C1",
    molecularWeight: 78.11,
    categoryUsage: "Industrial solvent",
  },
  {
    moleculeName: "Glucose",
    smilesStructure: "C(C1C(C(C(C(O1)O)O)O)O)O",
    molecularWeight: 180.16,
    categoryUsage: "Energy source/sugar",
  },
  {
    moleculeName: "Penicillin",
    smilesStructure: "CC1(C2C(C(C(O2)N1C(=O)COC(=O)C)C)S)C=O",
    molecularWeight: 334.39,
    categoryUsage: "Antibiotic",
  },
  {
    moleculeName: "Ibuprofen",
    smilesStructure: "CC(C)CC1=CC=C(C=C1)C(C)C(=O)O",
    molecularWeight: 206.28,
    categoryUsage: "Pain reliever/NSAID",
  },
  {
    moleculeName: "Acetaminophen",
    smilesStructure: "CC(=O)NC1=CC=C(O)C=C1",
    molecularWeight: 151.16,
    categoryUsage: "Pain reliever/Antipyretic",
  },
  {
    moleculeName: "Morphine",
    smilesStructure: "CN1CCC23C4C1CC(C2C3O)OC5=CC=CC=C45",
    molecularWeight: 285.34,
    categoryUsage: "Pain reliever/Opiate",
  },
  {
    moleculeName: "Nicotine",
    smilesStructure: "CN1CCCC1C2=CN=CC=C2",
    molecularWeight: 162.23,
    categoryUsage: "Stimulant",
  },
  {
    moleculeName: "Ethanol",
    smilesStructure: "CCO",
    molecularWeight: 46.07,
    categoryUsage: "Alcohol/Disinfectant",
  }
];

interface MoleculeBankTableProps {
  onlyGenerated?: boolean;
}

const TableOne: React.FC<MoleculeBankTableProps> = ({ onlyGenerated = false }) => {
  const { _id: userId } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [allMolecules, setAllMolecules] = useState<any[]>(onlyGenerated ? [] : staticMoleculeBank);
  const [filteredMolecules, setFilteredMolecules] = useState<any[]>([]);
  const [expandedKey, setExpandedKey] = useState<number | null>(null);
  const [computedProps, setComputedProps] = useState<Record<number, ComputedMolProps | null>>({});

  const handleRowClick = useCallback(async (key: number, molecule: any) => {
    if (expandedKey === key) { setExpandedKey(null); return; }
    setExpandedKey(key);
    // If this molecule is missing properties (novel MolMIM), compute them via RDKit
    if (computedProps[key] === undefined && molecule.smilesStructure &&
        molecule.xlogp === null && molecule.tpsa === null) {
      const props = await computeMolProps(molecule.smilesStructure);
      setComputedProps(prev => ({ ...prev, [key]: props }));
    }
  }, [expandedKey, computedProps]);

  const fetchHistory = async () => {
    if (userId) {
      const history = await getMoleculeGenerationHistoryByUser(userId);
      const generatedMolecules = history.flatMap((entry: any) => 
        entry.generatedMolecules.map((m: any, index: number) => {
          const moleculeDetails = {
            moleculeName: m.name || (entry.smiles ? (entry.smiles.length > 20 ? entry.smiles.substring(0, 20) + "…" : entry.smiles) : 'Molecule'),
            smilesStructure: m.structure || m.smiles || "",
            molecularWeight: m.weight || 0,
            score: m.score || 0,
            categoryUsage: m.source === "molmim" ? "MolMIM" : "PubChem",
            isGenerated: true,            // Extra properties (may be null for novel MolMIM molecules → computed client-side)
            formula:    m.formula    || null,
            exactMass:  m.exactMass  || null,
            xlogp:      m.xlogp      ?? null,
            tpsa:       m.tpsa       ?? null,
            hbd:        m.hbd        ?? null,
            hba:        m.hba        ?? null,
            rotBonds:   m.rotBonds   ?? null,
            heavyAtoms: m.heavyAtoms ?? null,
            complexity: m.complexity ?? null,
            inchikey:   m.inchikey   || null,          };
          
          console.log("Loaded generated molecule:", moleculeDetails);
          return moleculeDetails;
        })
      );
      
      if (onlyGenerated) {
        setAllMolecules(generatedMolecules);
      } else {
        setAllMolecules([...staticMoleculeBank, ...generatedMolecules]);
      }
    }
  };

  useEffect(() => {
    fetchHistory();
    
    // Listen for custom event to refresh the table
    window.addEventListener('refreshMolecules', fetchHistory);
    return () => window.removeEventListener('refreshMolecules', fetchHistory);
  }, [userId, onlyGenerated]);

  useEffect(() => {
    const filteredData = allMolecules.filter((molecule) =>
      molecule.moleculeName.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    setFilteredMolecules(filteredData);
  }, [searchQuery, allMolecules]);

  return (
    <div className="rounded-lg border border-stroke bg-white px-5 pb-2.5 pt-6 shadow-default dark:border-[#181818] dark:bg-[#181818] sm:px-7.5 xl:pb-1">
      <h4 className="mb-6 text-xl font-semibold text-black dark:text-white">
        {onlyGenerated ? "Generated Molecules" : "Molecules"}
      </h4>

      {!onlyGenerated && (
        <input
          type="search"
          placeholder="Search molecule"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border-gray-300 text-gray-700 placeholder-gray-400 dark:border-gray-600 dark:placeholder-gray-500 text-md mb-4 w-full rounded-lg border bg-white px-4 py-3 shadow-sm outline-none focus:border-primary focus:ring-primary dark:bg-[#181818] dark:text-white"
        />
      )}
      
      <div className="flex flex-col">
        <div className="grid grid-cols-3 rounded-lg bg-gray-2 dark:bg-[#121212] sm:grid-cols-4">
          <div className="p-2.5 xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">
              Molecule Name
            </h5>
          </div>
          <div className="p-2.5 text-center xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">
              Structure
            </h5>
          </div>
          <div className="p-2.5 text-center xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">
              {onlyGenerated ? "Score (QED)" : "Mol. Weight (g/mol)"}
            </h5>
          </div>
          <div className="hidden p-2.5 text-center sm:block xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">
              {onlyGenerated ? "Source" : "Category"}
            </h5>
          </div>
        </div>

        {filteredMolecules.length > 0 ? (
          filteredMolecules.map((molecule, key) => {
            const isExpanded = expandedKey === key;
            // Prefer stored DB props; fall back to RDKit-computed for novel molecules
            const cp = computedProps[key];
            const xlogp      = molecule.xlogp      ?? cp?.xlogp      ?? null;
            const tpsa        = molecule.tpsa        ?? cp?.tpsa        ?? null;
            const hbd         = molecule.hbd         ?? cp?.hbd         ?? null;
            const hba         = molecule.hba         ?? cp?.hba         ?? null;
            const rotBonds    = molecule.rotBonds    ?? cp?.rotBonds    ?? null;
            const heavyAtoms  = molecule.heavyAtoms  ?? cp?.heavyAtoms  ?? null;
            const complexity  = molecule.complexity  ?? cp?.complexity  ?? null;
            const formula     = molecule.formula     || cp?.formula     || null;
            const exactMass   = molecule.exactMass   || cp?.exactMass   || null;
            const inchikey    = molecule.inchikey    || cp?.inchikey    || null;
            const lipinskiPass = (molecule.molecularWeight || cp?.weight) &&
              xlogp != null && hbd != null && hba != null
              ? (molecule.molecularWeight || cp?.weight) <= 500 && xlogp <= 5 && hbd <= 5 && hba <= 10
              : null;

            return (
              <React.Fragment key={key}>
                {/* Main row */}
                <div
                  className={`grid grid-cols-3 sm:grid-cols-4 ${
                    key === filteredMolecules.length - 1 && !isExpanded
                      ? ""
                      : "border-b border-stroke dark:border-strokedark"
                  }`}
                >
                  {/* Molecule Name */}
                  <div className="flex items-center p-2.5 xl:p-5">
                    <div>
                      <p className="font-medium text-black dark:text-white">
                        {molecule.moleculeName}
                      </p>
                      {molecule.isGenerated && molecule.smilesStructure && (
                        <p className="mt-1 max-w-[160px] truncate text-xs text-gray-400" title={molecule.smilesStructure}>
                          {molecule.smilesStructure}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Structure image */}
                  <div className="flex items-center justify-center p-2.5 xl:p-5">
                    <MoleculeStructure
                      id={`mol-${key}-${molecule.moleculeName.replace(/\s+/g, '-')}`}
                      structure={molecule.smilesStructure}
                      scores={molecule.score}
                      svgMode={true}
                      width={150}
                      height={150}
                    />
                  </div>

                  {/* Weight or Score */}
                  <div className="flex items-center justify-center p-2.5 xl:p-5">
                    <p className="text-black dark:text-white">
                      {onlyGenerated
                        ? molecule.score > 0 ? molecule.score.toFixed(4) : "\u2014"
                        : molecule.molecularWeight ? `${molecule.molecularWeight}` : "\u2014"}
                    </p>
                  </div>

                  {/* Source / Category + Details button */}
                  <div className="hidden flex-col items-center justify-center gap-2 p-2.5 sm:flex xl:p-5">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                        molecule.categoryUsage === "MolMIM"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                          : molecule.categoryUsage === "PubChem"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {molecule.categoryUsage}
                    </span>
                    <button
                      onClick={() => handleRowClick(key, molecule)}
                      className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                        isExpanded
                          ? "border-primary bg-primary text-white"
                          : "border-stroke text-gray-500 hover:border-primary hover:text-primary dark:border-strokedark dark:text-gray-400 dark:hover:border-primary dark:hover:text-primary"
                      }`}
                    >
                      {isExpanded ? "Hide" : "Details"}
                    </button>
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="col-span-4 border-b border-stroke bg-gray-50 p-4 dark:border-strokedark dark:bg-[#141414]">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {formula && <DetailCard label="Formula" value={formula} />}
                      {molecule.molecularWeight > 0 && (
                        <DetailCard label="Mol. Weight" value={`${molecule.molecularWeight} g/mol`} />
                      )}
                      {exactMass && <DetailCard label="Exact Mass" value={exactMass} />}
                      {xlogp != null && <DetailCard label="XLogP" value={xlogp} hint="Lipophilicity" />}
                      {tpsa != null && <DetailCard label="TPSA" value={`${tpsa} Å²`} hint="Polar surface area" />}
                      {hbd != null && <DetailCard label="H-Bond Donors" value={hbd} />}
                      {hba != null && <DetailCard label="H-Bond Acceptors" value={hba} />}
                      {rotBonds != null && <DetailCard label="Rotatable Bonds" value={rotBonds} />}
                      {heavyAtoms != null && <DetailCard label="Heavy Atoms" value={heavyAtoms} />}
                      {complexity != null && <DetailCard label="Complexity" value={complexity} />}
                      {molecule.score > 0 && onlyGenerated && (
                        <DetailCard label="QED Score" value={molecule.score.toFixed(6)} hint="Drug-likeness" />
                      )}
                      {lipinskiPass != null && (
                        <div className="rounded-lg border border-stroke p-3 dark:border-strokedark">
                          <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Lipinski Ro5</p>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            lipinskiPass
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          }`}>
                            {lipinskiPass ? "✓ PASS" : "✗ FAIL"}
                          </span>
                        </div>
                      )}
                    </div>
                    {inchikey && (
                      <p className="mt-3 break-all text-xs text-gray-400">
                        <span className="font-medium text-gray-500 dark:text-gray-400">InChIKey: </span>{inchikey}
                      </p>
                    )}
                    {molecule.isGenerated && xlogp === null && computedProps[key] === undefined && (
                      <p className="mt-2 text-xs text-gray-400 italic">Click to compute properties via RDKit…</p>
                    )}
                    {molecule.isGenerated && xlogp === null && computedProps[key] === null && (
                      <p className="mt-2 text-xs text-amber-500">Novel molecule — RDKit could not parse SMILES.</p>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })
        ) : (
          <div className="p-5 text-center text-gray-500">
            No molecules found.
          </div>
        )}
      </div>
    </div>
  );
};

// ── Small helper card ──────────────────────────────────────────────────────────
function DetailCard({ label, value, hint }: { label: string; value: any; hint?: string }) {
  return (
    <div className="rounded-lg border border-stroke p-3 dark:border-strokedark">
      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="font-medium text-black dark:text-white">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default TableOne;
