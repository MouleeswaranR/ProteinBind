"use client";
import DefaultLayout from "@/components/Layouts/DefaultLayout";
import ComponentHeader from "@/components/ComponentHeader/ComponentHeader";
import MoleculeBankTable from "@/components/MoleculeBank/MoleculeBankTable";

export default function ResearchPage() {
  return (
    <DefaultLayout>
      <div className="container mx-auto h-auto min-h-[100dvh] p-0">
        <ComponentHeader pageName="Research" containActionButton={true} />
        
        <div className="mt-10">
          <MoleculeBankTable onlyGenerated={true} />
        </div>
      </div>
    </DefaultLayout>
  );
}
