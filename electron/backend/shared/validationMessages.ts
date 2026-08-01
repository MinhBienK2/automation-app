/**
 * Validation message strings shared by the graph compiler, the graph
 * node-semantics validator, and the action config validator.
 *
 * These three modules independently authored the same user-facing text hundreds
 * of times — "Output variable name is required" alone appeared 95 times across
 * them. Rewording one occurrence used to leave the other 94 stale, and nothing
 * caught it. Only strings that appear in more than one place live here; a
 * message authored once belongs at its single call site.
 */

export const outputVariableNameRequired = "Output variable name is required";
export const variableNameRequired = "Variable name is required";
export const sourceVariableNameRequired = "Source variable name is required";
export const sourceListVariableNameRequired = "Source list variable name is required";
export const targetListVariableNameRequired = "Target list variable name is required";
export const outputNameRequired = "Output name is required";
export const resultOutputVariableNameRequired = "Result output variable name is required";
export const propertyKeyRequired = "Property key is required";
export const sourceOutputRequired = "Source output is required";
export const valueTypeMustBeVariableValueType = "Value type must be text, json, number, or boolean";
export const regexPatternRequired = "Regex pattern is required";
