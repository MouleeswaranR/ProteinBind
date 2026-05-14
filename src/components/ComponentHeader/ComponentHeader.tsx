"use client";
import Modal from "@/components/ui/Modal";
import React, { useState } from "react";
import { useUser } from "@/app/context/UserContext";
import { createMoleculeGenerationHistory } from "@/lib/actions/molecule-generation.action";
import { useRouter } from "next/navigation";

interface ComponentHeaderProps {
  pageName: string;
  containActionButton?: boolean;
}

const ComponentHeader: React.FC<ComponentHeaderProps> = ({
  pageName,
  containActionButton,
}) => {
  const { _id: userId } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    smiles: "",
    numMolecules: 10,
    minSimilarity: 0.7,
    particles: 30,
    iterations: 10,
  });

  const openModal = (modalId: string) => {
    const modal = document.getElementById(modalId) as HTMLDialogElement;
    if (modal) {
      modal.showModal();
    }
  };

  const closeModal = (modalId: string) => {
    const modal = document.getElementById(modalId) as HTMLDialogElement;
    if (modal) {
      modal.close();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "smiles" ? value : parseFloat(value),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/molecule-generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          skeletons: [formData.smiles],
          num_molecules: formData.numMolecules,
          min_similarity: formData.minSimilarity,
          particles: formData.particles,
          iterations: formData.iterations,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("API Error Details:", data);
        throw new Error(data.error || data.message || "Failed to generate molecules");
      }
      
      // Save to database
      await createMoleculeGenerationHistory(
        {
          smiles: formData.smiles,
          numMolecules: formData.numMolecules,
          minSimilarity: formData.minSimilarity,
          particles: formData.particles,
          iterations: formData.iterations,
          generatedMolecules: data.molecules ? data.molecules.map((m: any) => ({
            structure: m.smiles || m.structure,
            name: m.name || "",
            weight: parseFloat(m.weight) || 0,
            score: parseFloat(m.score) || 0,
            source: data.source || "pubchem",
          })).filter((m: any) => m.structure) : [],
        },
        userId,
      );

      closeModal("my_modal_1");
      // Trigger a refresh event for components listening
      window.dispatchEvent(new Event('refreshMolecules'));
      router.refresh();
    } catch (error: any) {
      console.error("Error generating molecules:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-title-md2 font-semibold text-black dark:text-white">
        {pageName}
      </h2>

      {containActionButton && (
        <nav>
          <ol className="flex items-center gap-2">
            <li
              onClick={() => openModal("my_modal_1")}
              className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-center font-medium text-white"
            >
              Add Molecule
            </li>
          </ol>
        </nav>
      )}

      <Modal
        id="my_modal_1"
        title="Generate New Molecules"
        content={
          <>
            <form onSubmit={handleSubmit}>
              <div className="p-1">
                <div className="mb-4.5 flex flex-col gap-6 xl:flex-row">
                  <div className="w-full xl:w-1/2">
                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                      SMILES String (Skeleton)
                    </label>
                    <input
                      type="text"
                      name="smiles"
                      value={formData.smiles}
                      onChange={handleChange}
                      placeholder="e.g. CC(=O)OC1=CC=CC=C1C(O)=O"
                      required
                      className="w-full rounded-lg border-[1.5px] bg-transparent  px-5 py-3 text-black outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-gray-2 dark:bg-[#181818] dark:text-white dark:focus:border-primary"
                    />
                  </div>

                  <div className="w-full xl:w-1/2">
                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                      Number of Molecules
                    </label>
                    <input
                      type="number"
                      name="numMolecules"
                      value={formData.numMolecules}
                      onChange={handleChange}
                      placeholder="Enter No of Molecules"
                      className="w-full rounded-lg border-[1.5px] bg-transparent  px-5 py-3 text-black outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-gray-2 dark:bg-[#181818] dark:text-white dark:focus:border-primary"
                    />
                  </div>
                </div>

                <div className="mb-4.5 flex flex-col gap-6 xl:flex-row">
                  <div className="w-full xl:w-1/2">
                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                      Minimum Similarity
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="minSimilarity"
                      value={formData.minSimilarity}
                      onChange={handleChange}
                      placeholder="e.g. 0.7"
                      className="w-full rounded-lg border-[1.5px] bg-transparent  px-5 py-3 text-black outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-gray-2 dark:bg-[#181818] dark:text-white dark:focus:border-primary"
                    />
                  </div>
                  <div className="w-full xl:w-1/2">
                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                      Particles
                    </label>
                    <input
                      type="number"
                      name="particles"
                      value={formData.particles}
                      onChange={handleChange}
                      placeholder="e.g. 30"
                      className="w-full rounded-lg border-[1.5px] bg-transparent  px-5 py-3 text-black outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-gray-2 dark:bg-[#181818] dark:text-white dark:focus:border-primary"
                    />
                  </div>
                  <div className="w-full xl:w-1/2">
                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                      Iterations
                    </label>
                    <input
                      type="number"
                      name="iterations"
                      value={formData.iterations}
                      onChange={handleChange}
                      placeholder="e.g. 10"
                      className="w-full rounded-lg border-[1.5px] bg-transparent  px-5 py-3 text-black outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-gray-2 dark:bg-[#181818] dark:text-white dark:focus:border-primary"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full justify-center rounded-lg bg-primary p-3 font-medium text-gray hover:bg-opacity-90 disabled:bg-opacity-50"
                >
                  {loading ? "Generating..." : "Generate Molecules"}
                </button>
              </div>
            </form>
          </>
        }
        onCloseText="Close"
      />
    </div>
  );
};

export default ComponentHeader;
