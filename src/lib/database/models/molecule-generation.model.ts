import { Schema, model, models } from "mongoose";

const MoleculeGenerationHistorySchema = new Schema(
  {
    smiles: {
      type: String,
      required: true,
    },
    numMolecules: {
      type: Number,
      required: true,
    },
    minSimilarity: {
      type: Number,
      required: true,
    },
    particles: {
      type: Number,
      required: true,
    },
    iterations: {
      type: Number,
      required: true,
    },
    generatedMolecules: [
      {
        structure:    { type: String, required: true },
        name:         { type: String, default: "" },
        formula:      { type: String, default: "" },
        weight:       { type: Number, default: 0 },
        exactMass:    { type: Number, default: 0 },
        score:        { type: Number, required: true },
        xlogp:        { type: Number, default: null },
        tpsa:         { type: Number, default: null },
        hbd:          { type: Number, default: null },
        hba:          { type: Number, default: null },
        rotBonds:     { type: Number, default: null },
        heavyAtoms:   { type: Number, default: null },
        complexity:   { type: Number, default: null },
        inchikey:     { type: String, default: "" },
        source:       { type: String, default: "" },
      },
    ],
    user: {
      type: Schema.Types.ObjectId,
      ref: "User", // Reference to the user model
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

const MoleculeGenerationHistory =
  models.MoleculeGenerationHistory ||
  model("MoleculeGenerationHistory", MoleculeGenerationHistorySchema);

export default MoleculeGenerationHistory;
