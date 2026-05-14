// app/api/molecule-generation/route.ts

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Support both skeletons (array) and smiles (string) inputs
    const inputSmiles = body.skeletons?.[0] || body.smiles;
    const numMolecules = body.num_molecules || 5;

    console.log("Incoming request for PubChem similarity search:", { inputSmiles, numMolecules });

    if (!inputSmiles) {
      return NextResponse.json(
        { error: 'Missing input SMILES' },
        { status: 400 }
      );
    }

    // Step 1: Search for similar compounds in PubChem to "generate" candidates
    // We use the 2D fast similarity search endpoint
    const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastsimilarity_2d/smiles/${encodeURIComponent(inputSmiles)}/cids/JSON?MaxRecords=${numMolecules}`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchResponse.ok) {
      console.error("PubChem Search Error:", searchData);
      return NextResponse.json(
        { error: 'PubChem similarity search failed', details: searchData },
        { status: searchResponse.status }
      );
    }

    const cids = searchData.IdentifierList?.CID;

    if (!cids || cids.length === 0) {
      return NextResponse.json({ molecules: [] });
    }

    // Step 2: Fetch the CanonicalSMILES, IsomericSMILES, IUPACName, and MolecularWeight
    const propertyUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cids.join(',')}/property/CanonicalSMILES,IsomericSMILES,IUPACName,MolecularWeight/JSON`;
    
    console.log("Fetching properties from PubChem URL:", propertyUrl);
    const propertyResponse = await fetch(propertyUrl);
    const propertyData = await propertyResponse.json();

    if (!propertyResponse.ok) {
      console.error("PubChem Property Error:", propertyData);
      return NextResponse.json(
        { error: 'Failed to fetch molecule properties from PubChem', details: propertyData },
        { status: propertyResponse.status }
      );
    }

    const properties = propertyData.PropertyTable?.Properties || [];

    console.log(`Found ${properties.length} property sets from PubChem.`);
    if (properties.length > 0) {
      console.log("Keys available in PubChem property object:", Object.keys(properties[0]));
    }

    // Step 3: Format the response to match what the frontend expects
    const molecules = properties.map((prop: any, i: number) => {
      // Use whatever SMILES field is available
      const smiles = prop.CanonicalSMILES || prop.IsomericSMILES;
      
      if (!smiles) {
        console.log(`CID ${prop.CID} missing SMILES data. Available keys:`, Object.keys(prop));
        return null;
      }

      return {
        smiles: smiles,
        name: prop.IUPACName || `CID: ${prop.CID}`,
        weight: prop.MolecularWeight || 0,
        score: 0.85, // Score isn't provided by PubChem similarity search, keeping a static placeholder for UI
      };
    }).filter(Boolean); // Remove null entries

    console.log("Final molecules array being sent to frontend:", JSON.stringify(molecules, null, 2));

    return NextResponse.json({ molecules });

  } catch (error: any) {
    console.error("Internal Server Error in Molecule Generation:", error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
