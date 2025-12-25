import emergencyData from "../data/emergency_data.json";
import { AnalysisResult } from "./aiService";

export interface EmergencyProtocol {
  level: string;
  response: string;
  steps: string[];
  condition: string;
  severity: number;
  confidence: number;
  shouldCallEmergency: boolean;
}

interface ProtocolData {
  condition: string;
  name: string;
  steps: string[];
  keywords?: string[];
  triageLevel?: string;
}

interface EmergencyDataStructure {
  protocols: ProtocolData[];
}

/**
 * Map AI analysis results to emergency protocols
 */
export const getEmergencyProtocol = (
  analysisResult: AnalysisResult,
): EmergencyProtocol => {
  const { condition, severity, confidence, symptoms } = analysisResult;

  // Find matching protocol in emergency_data.json using condition and symptoms/keywords
  const protocol = findBestProtocolMatch(condition, symptoms);

  if (!protocol) {
    return generateDefaultProtocol(analysisResult);
  }

  // Determine triage level based on severity
  const triageLevel = determineTriageLevel(severity);

  // Generate response message
  const response = generateResponseMessage(protocol, triageLevel, confidence);

  return {
    level: triageLevel,
    response,
    steps: protocol.steps || [],
    condition: protocol.name || condition,
    severity,
    confidence,
    shouldCallEmergency:
      triageLevel === "CRITICAL" || triageLevel === "EMERGENCY",
  };
};

/**
 * Find protocol by condition name
 */
const findProtocolByCondition = (condition: string): ProtocolData | null => {
  try {
    const data = emergencyData as EmergencyDataStructure;

    if (!data || !data.protocols) {
      return null;
    }

    // First try exact match
    let protocol = data.protocols.find(
      (p) => p.condition.toLowerCase() === condition.toLowerCase(),
    );

    // If no exact match, try partial match
    if (!protocol) {
      protocol = data.protocols.find(
        (p) =>
          p.condition.toLowerCase().includes(condition.toLowerCase()) ||
          condition.toLowerCase().includes(p.condition.toLowerCase()),
      );
    }

    // If still no match, try keywords
    if (!protocol) {
      protocol = data.protocols.find(
        (p) =>
          p.keywords &&
          p.keywords.some((k) =>
            condition.toLowerCase().includes(k.toLowerCase()),
          ),
      );
    }

    return protocol || null;
  } catch (error) {
    console.error("Error finding protocol:", error);
    return null;
  }
};

const findBestProtocolMatch = (
  condition: string,
  symptoms?: string[],
): ProtocolData | null => {
  const primary = findProtocolByCondition(condition);
  if (primary) return primary;

  if (symptoms && symptoms.length) {
    const lowerSymptoms = symptoms.map((s) => s.toLowerCase());
    const data = emergencyData as EmergencyDataStructure;
    if (!data?.protocols) return null;

    const keywordHit = data.protocols.find((p) =>
      p.keywords?.some((k) =>
        lowerSymptoms.some((s) => s.includes(k.toLowerCase())),
      ),
    );
    if (keywordHit) return keywordHit;
  }

  return null;
};

/**
 * Determine triage level (1-5 scale)
 * 1 = Non-urgent, 5 = Critical
 */
const determineTriageLevel = (severity: number): string => {
  if (severity >= 4.5) return "CRITICAL";
  if (severity >= 3.5) return "EMERGENCY";
  if (severity >= 2.5) return "URGENT";
  if (severity >= 1.5) return "LESS URGENT";
  return "NON-URGENT";
};

/**
 * Generate human-readable response message
 */
const generateResponseMessage = (
  protocol: ProtocolData,
  triageLevel: string,
  confidence: number,
): string => {
  const confidenceText =
    confidence >= 0.8 ? "high" : confidence >= 0.5 ? "moderate" : "low";

  let message = `Based on my analysis (${confidenceText} confidence), this appears to be:\n\n`;
  message += `**${protocol.name}**\n`;
  message += `Triage Level: **${triageLevel}**\n\n`;

  if (triageLevel === "CRITICAL" || triageLevel === "EMERGENCY") {
    message += `⚠️ **CALL EMERGENCY SERVICES IMMEDIATELY** ⚠️\n\n`;
  }

  if (protocol.steps?.length) {
    message += `Recommended Actions:\n• ${protocol.steps.join("\n• ")}`;
  }

  return message;
};

/**
 * Generate default protocol when no match found
 */
const generateDefaultProtocol = (
  analysisResult: AnalysisResult,
): EmergencyProtocol => {
  const { severity, symptoms, condition } = analysisResult;
  const triageLevel = determineTriageLevel(severity);

  let response = `I've analyzed your input. `;

  if (symptoms && symptoms.length > 0) {
    response += `You mentioned: ${symptoms.join(", ")}.\n\n`;
  }

  response += `Triage Level: **${triageLevel}**\n\n`;

  const defaultSteps = [
    "Stay calm and assess the situation",
    "If symptoms worsen, seek immediate medical attention",
    "Monitor vital signs if possible",
    "Keep the person comfortable and reassured",
  ];

  if (triageLevel === "CRITICAL" || triageLevel === "EMERGENCY") {
    response += `⚠️ **CALL EMERGENCY SERVICES IMMEDIATELY** ⚠️\n\n`;
    defaultSteps.unshift(
      "Call emergency services (999 or local emergency number)",
    );
  }

  response += `Recommended Actions:\n• ${defaultSteps.join("\n• ")}`;

  return {
    level: triageLevel,
    response,
    steps: defaultSteps,
    condition: condition || "general_emergency",
    severity: analysisResult.severity,
    confidence: analysisResult.confidence,
    shouldCallEmergency:
      triageLevel === "CRITICAL" || triageLevel === "EMERGENCY",
  };
};

/**
 * Get all available protocols
 */
export const getAllProtocols = (): ProtocolData[] => {
  try {
    const data = emergencyData as EmergencyDataStructure;
    return data?.protocols || [];
  } catch (error) {
    console.error("Error getting protocols:", error);
    return [];
  }
};

/**
 * Search protocols by keywords
 */
export const searchProtocols = (query: string): ProtocolData[] => {
  const protocols = getAllProtocols();
  const lowerQuery = query.toLowerCase();

  return protocols.filter(
    (protocol) =>
      protocol.name.toLowerCase().includes(lowerQuery) ||
      protocol.condition.toLowerCase().includes(lowerQuery) ||
      (protocol.keywords &&
        protocol.keywords.some((k) => k.toLowerCase().includes(lowerQuery))),
  );
};
