import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import { TensorflowModel, useTensorflowModel } from "react-native-fast-tflite";

// Model paths
const MOBILEBERT_MODEL = require("../assets/models/mobilebert.tflite");
const MOBILENET_MODEL = require("../assets/models/mobilenet_v2.tflite");

export interface AnalysisResult {
  condition: string;
  severity: number;
  confidence: number;
  symptoms?: string[];
  visualFindings?: string[];
}

export interface AnalysisInput {
  text?: string;
  imageUri?: string;
}

// Model instances
let textModelPath: string | null = null;
let imageModelPath: string | null = null;
let textModelSource: any = null;
let imageModelSource: any = null;
let textModelInstance: TensorflowModel | null = null;
let imageModelInstance: TensorflowModel | null = null;
let modelsInitialized = false;

/**
 * Initialize TFLite models - loads models to local filesystem
 */
export const initializeModels = async (): Promise<boolean> => {
  try {
    if (modelsInitialized) {
      return true;
    }

    // Load MobileBERT for text classification
    const textAsset = Asset.fromModule(MOBILEBERT_MODEL);
    await textAsset.downloadAsync();
    textModelPath = textAsset.localUri || textAsset.uri;
    textModelSource = { uri: textModelPath };

    // Load MobileNet V2 for image classification
    const imageAsset = Asset.fromModule(MOBILENET_MODEL);
    await imageAsset.downloadAsync();
    imageModelPath = imageAsset.localUri || imageAsset.uri;
    imageModelSource = { uri: imageModelPath };

    modelsInitialized = true;
    console.log("Models initialized successfully");
    console.log("Text model path:", textModelPath);
    console.log("Image model path:", imageModelPath);
    return true;
  } catch (error) {
    console.error("Error initializing models:", error);
    return false;
  }
};

/**
 * Preprocess text input for BERT model
 * Returns token IDs as Float32Array
 */
const preprocessText = (text: string): Float32Array => {
  // Basic tokenization - in production, use proper BERT tokenizer
  const tokens = text.toLowerCase().split(/\s+/);
  const maxLength = 128;

  // Simple word to ID mapping (placeholder - use actual BERT vocab)
  const tokenIds = tokens.slice(0, maxLength).map((token) => {
    // This is a placeholder - use real BERT tokenizer
    return token.charCodeAt(0) % 30000; // Mock token ID
  });

  // Pad to maxLength
  while (tokenIds.length < maxLength) {
    tokenIds.push(0); // PAD token
  }

  return new Float32Array(tokenIds);
};

/**
 * Preprocess image for MobileNet
 * Returns normalized pixel values as Float32Array
 */
const preprocessImage = async (imageUri: string): Promise<Float32Array> => {
  try {
    const info = await FileSystem.getInfoAsync(imageUri);
    if (!info.exists) {
      throw new Error(`Image not found at ${imageUri}`);
    }

    // Read image as base64 and convert to normalized float array
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: "base64" as any,
    });

    const binary = globalThis.atob
      ? globalThis.atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
    const len = binary.length;
    const floats = new Float32Array(len);
    for (let i = 0; i < len; i += 1) {
      floats[i] = binary.charCodeAt(i) / 255;
    }

    return floats;
  } catch (error) {
    console.error("Error preprocessing image:", error);
    throw error;
  }
};

const loadTextModel = async (): Promise<TensorflowModel | null> => {
  if (textModelInstance) return textModelInstance;
  if (!textModelSource) {
    await initializeModels();
  }
  if (!textModelSource) return null;

  const plugin = useTensorflowModel(textModelSource);
  textModelInstance = plugin?.model ?? null;
  return textModelInstance;
};

const loadImageModel = async (): Promise<TensorflowModel | null> => {
  if (imageModelInstance) return imageModelInstance;
  if (!imageModelSource) {
    await initializeModels();
  }
  if (!imageModelSource) return null;

  const plugin = useTensorflowModel(imageModelSource);
  imageModelInstance = plugin?.model ?? null;
  return imageModelInstance;
};

/**
 * Run inference on text input using MobileBERT
 */
const analyzeText = async (text: string): Promise<AnalysisResult> => {
  try {
    const model = await loadTextModel();
    if (!model) return fallbackTextAnalysis(text);

    // Preprocess text to tensor input
    const inputTensor = preprocessText(text);

    // Run inference
    const outputs = await model.run([inputTensor]);

    if (!outputs || outputs.length === 0) {
      return fallbackTextAnalysis(text);
    }

    // Parse output
    // Assuming output is [batch, num_classes]
    const output = outputs[0] as Float32Array;
    const predictions = Array.from(output);

    // Get top prediction
    const maxIndex = predictions.indexOf(Math.max(...predictions));
    const confidence = predictions[maxIndex];

    // Map index to condition (this mapping depends on your model)
    const conditionMap = [
      "chest_pain",
      "bleeding",
      "fracture",
      "burn",
      "unconscious",
      "breathing",
      "headache",
      "fever",
      "general",
    ];
    const condition = conditionMap[maxIndex] || "general";

    // Determine severity based on condition and confidence
    const severity = determineSeverityFromCondition(condition, confidence);

    return {
      condition,
      severity,
      confidence,
      symptoms: extractSymptoms(text),
    };
  } catch (error) {
    console.error("Text analysis error:", error);
    return fallbackTextAnalysis(text);
  }
};

/**
 * Run inference on image input using MobileNet
 */
const analyzeImage = async (imageUri: string): Promise<AnalysisResult> => {
  try {
    const model = await loadImageModel();
    if (!model) {
      return {
        condition: "unknown",
        severity: 2,
        confidence: 0.5,
        visualFindings: ["Image analysis unavailable"],
      };
    }

    // For image input, many TFLite models accept the URI directly
    // Or preprocess to Float32Array
    const inputTensor = await preprocessImage(imageUri);

    // Run inference
    const outputs = await model.run([inputTensor]);

    if (!outputs || outputs.length === 0) {
      return {
        condition: "unknown",
        severity: 2,
        confidence: 0.5,
        visualFindings: ["Image analysis unavailable"],
      };
    }

    // Parse output
    const output = outputs[0] as Float32Array;
    const predictions = Array.from(output);

    const maxIndex = predictions.indexOf(Math.max(...predictions));
    const confidence = predictions[maxIndex];

    // Map to medical conditions
    const conditionMap = [
      "wound",
      "burn",
      "fracture",
      "bruise",
      "rash",
      "normal",
    ];
    const condition = conditionMap[maxIndex] || "unknown";

    const severity = determineSeverityFromCondition(condition, confidence);

    return {
      condition,
      severity,
      confidence,
      visualFindings: [
        `Detected: ${condition} (${(confidence * 100).toFixed(1)}% confidence)`,
      ],
    };
  } catch (error) {
    console.error("Image analysis error:", error);
    return {
      condition: "unknown",
      severity: 2,
      confidence: 0.5,
      visualFindings: ["Error analyzing image"],
    };
  }
};

/**
 * Determine severity from condition name
 */
const determineSeverityFromCondition = (
  condition: string,
  confidence: number,
): number => {
  const criticalConditions = [
    "chest_pain",
    "unconscious",
    "not_breathing",
    "cardiac_arrest",
  ];
  const emergencyConditions = [
    "bleeding",
    "severe_bleeding",
    "head_injury",
    "seizure",
  ];
  const urgentConditions = ["fracture", "burn", "wound"];

  if (criticalConditions.includes(condition)) return 5;
  if (emergencyConditions.includes(condition)) return 4;
  if (urgentConditions.includes(condition)) return 3;
  if (confidence < 0.5) return 2; // Low confidence = lower severity
  return 2;
};

/**
 * Extract symptoms from text using keyword matching
 */
const extractSymptoms = (text: string): string[] => {
  const symptomKeywords = [
    "pain",
    "bleeding",
    "fracture",
    "burn",
    "unconscious",
    "breathing",
    "chest pain",
    "headache",
    "fever",
    "nausea",
    "dizziness",
    "vomiting",
    "swelling",
    "rash",
    "cough",
    "weakness",
    "numbness",
    "confusion",
    "seizure",
    "choking",
  ];

  const lowerText = text.toLowerCase();
  return symptomKeywords.filter((symptom) => lowerText.includes(symptom));
};

/**
 * Fallback analysis when model inference fails
 */
const fallbackTextAnalysis = (text: string): AnalysisResult => {
  const symptoms = extractSymptoms(text);
  const lowerText = text.toLowerCase();

  // Critical severity keywords (severity 5)
  const criticalKeywords = [
    "not breathing",
    "unconscious",
    "unresponsive",
    "severe bleeding",
    "massive bleeding",
    "cardiac arrest",
    "heart attack",
    "stroke",
    "choking",
    "severe chest pain",
  ];

  // High severity keywords (severity 4)
  const highSeverityKeywords = [
    "chest pain",
    "difficulty breathing",
    "heavy bleeding",
    "severe pain",
    "broken bone",
    "head injury",
    "seizure",
    "allergic reaction",
  ];

  // Moderate severity keywords (severity 3)
  const moderateSeverityKeywords = [
    "bleeding",
    "fracture",
    "burn",
    "vomiting",
    "fever",
    "pain",
  ];

  // Determine severity
  let severity = 1;
  let condition = "general";

  if (criticalKeywords.some((keyword) => lowerText.includes(keyword))) {
    severity = 5;
    condition =
      criticalKeywords.find((k) => lowerText.includes(k)) ||
      "critical_emergency";
  } else if (
    highSeverityKeywords.some((keyword) => lowerText.includes(keyword))
  ) {
    severity = 4;
    condition =
      highSeverityKeywords.find((k) => lowerText.includes(k)) || "emergency";
  } else if (
    moderateSeverityKeywords.some((keyword) => lowerText.includes(keyword))
  ) {
    severity = 3;
    condition =
      moderateSeverityKeywords.find((k) => lowerText.includes(k)) || "urgent";
  } else if (symptoms.length > 0) {
    severity = 2;
    condition = symptoms[0];
  }

  return {
    condition: condition.replace(/\s+/g, "_"),
    severity,
    confidence: 0.6,
    symptoms,
  };
};

/**
 * Main analysis function - handles both text and image inputs
 */
export const analyzeUserInput = async (
  input: AnalysisInput,
): Promise<AnalysisResult> => {
  try {
    // Initialize models if not already done (non-blocking)
    if (!modelsInitialized) {
      initializeModels().catch((err) =>
        console.warn("Model initialization failed, using fallback:", err),
      );
    }

    if (input.imageUri) {
      return await analyzeImage(input.imageUri);
    } else if (input.text) {
      return await analyzeText(input.text);
    } else {
      throw new Error("No input provided");
    }
  } catch (error) {
    console.error("Analysis error:", error);
    throw error;
  }
};
