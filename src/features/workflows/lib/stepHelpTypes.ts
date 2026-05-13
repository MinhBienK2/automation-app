export type StepHelpLanguage = "vi" | "en";
export type HelpFieldCategory = "required" | "optional" | "advanced";

export type StepHelpContent = {
  title: string;
  summary: string;
  useWhen: string[];
  notFor?: string[];
  chooseInstead?: Array<{
    action: string;
    when: string;
  }>;
  fields: Array<{
    name: string;
    description: string;
    details?: string[];
  }>;
  fieldReference?: ActionFieldReference[];
  minimalConfig?: Array<{
    name: string;
    description: string;
  }>;
  advancedConfig?: Array<{
    name: string;
    description: string;
    whenToUse?: string;
  }>;
  workflowExamples?: Array<{
    title: string;
    steps: string[];
    notes?: string[];
  }>;
  outputs?: Array<{
    name: string;
    description: string;
    usedBy: string[];
  }>;
  examples: string[];
  commonMistakes: string[];
  safetyNotes?: string[];
};

export type ActionFieldReference = {
  name: string;
  category: HelpFieldCategory;
  description: string;
  requiredWhen: string;
  valueGuidance?: string;
  example?: string;
  mistakes?: string[];
  details: string[];
  options?: ActionFieldOptionReference[];
};

export type ActionFieldOptionReference = {
  label: string;
  value?: string;
  description: string;
  useWhen: string;
  avoidWhen?: string;
  example?: string;
};

export type BilingualStepHelp = Record<StepHelpLanguage, StepHelpContent>;
