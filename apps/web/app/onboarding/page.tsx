"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { BranchesStep } from "./_components/BranchesStep";
import { ClientsStep } from "./_components/ClientsStep";
import { CompanyStep } from "./_components/CompanyStep";
import { EmployeesStep } from "./_components/EmployeesStep";
import { MachinesStep } from "./_components/MachinesStep";
import { STEPS } from "./_components/steps";
import { SuppliersStep } from "./_components/SuppliersStep";

function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requested = Number(searchParams.get("step") ?? "0");
  const stepIndex = Number.isFinite(requested) ? Math.min(Math.max(requested, 0), STEPS.length - 1) : 0;
  const step = STEPS[stepIndex];

  const goToStep = (index: number) => router.push(`/onboarding?step=${index}`);

  const next = () => {
    if (stepIndex < STEPS.length - 1) {
      goToStep(stepIndex + 1);
    } else {
      router.push("/");
    }
  };

  const back = stepIndex > 0 ? () => goToStep(stepIndex - 1) : undefined;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-gray-500">
          Step {stepIndex + 1} of {STEPS.length}: {step.label}
        </p>
        <div className="mt-2 flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s.key} className={`h-1 flex-1 rounded ${i <= stepIndex ? "bg-gray-900" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>

      {step.key === "company" && <CompanyStep onNext={next} />}
      {step.key === "branches" && <BranchesStep onNext={next} onBack={back} />}
      {step.key === "machines" && <MachinesStep onNext={next} onBack={back} />}
      {step.key === "employees" && <EmployeesStep onNext={next} onBack={back} />}
      {step.key === "clients" && <ClientsStep onNext={next} onBack={back} />}
      {step.key === "suppliers" && <SuppliersStep onNext={next} onBack={back} />}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-500">Loading...</div>}>
      <OnboardingWizard />
    </Suspense>
  );
}
