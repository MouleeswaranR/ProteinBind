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
        structure: { type: String, required: true },
        name: { type: String, default: "" },
        weight: { type: Number, default: 0 },
        score: { type: Number, required: true },
        source: { type: String, default: "" },
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
