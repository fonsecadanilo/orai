/**
 * Flow Version Guard
 * 
 * Utilities to identify flow version and prevent mixing v3.1 and legacy processing.
 */

export interface FlowMetadata {
  source?: string;
  version?: string;
  [key: string]: unknown;
}

/**
 * Check if a flow was created by the v3.1 pipeline
 */
export function isV31Flow(metadata?: FlowMetadata | null): boolean {
  if (!metadata) return false;
  return metadata.source === "v3.1-pipeline" || metadata.version === "3.1";
}

/**
 * Check if a flow is legacy (not v3.1)
 */
export function isLegacyFlow(metadata?: FlowMetadata | null): boolean {
  return !isV31Flow(metadata);
}

/**
 * Get the appropriate layout owner for a flow
 */
export function getLayoutOwner(metadata?: FlowMetadata | null): "flow-connector" | "engine" {
  return isV31Flow(metadata) ? "flow-connector" : "engine";
}

/**
 * Should the legacy engine process this flow?
 * Returns false for v3.1 flows (they use Flow Connector)
 */
export function shouldUseLegacyEngine(metadata?: FlowMetadata | null): boolean {
  return isLegacyFlow(metadata);
}

/**
 * Get flow version label
 */
export function getFlowVersionLabel(metadata?: FlowMetadata | null): string {
  if (isV31Flow(metadata)) {
    return "v3.1 (Pipeline)";
  }
  if (metadata?.version) {
    return `v${metadata.version}`;
  }
  return "Legacy";
}




