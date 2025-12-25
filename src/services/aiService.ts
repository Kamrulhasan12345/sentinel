import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import { TensorflowModel } from "react-native-fast-tflite";
// NOTE: We avoid hook usage here to prevent invalid hook call errors in services.

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

export interface AnalysisOptions {
  textModel?: TensorflowModel | null;
  imageModel?: TensorflowModel | null;
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
const preprocessText = (
  text: string,
  targetLength: number,
  useInt32: boolean,
) => {
  // Basic whitespace tokenization (placeholder). Replace with proper tokenizer + vocab for production.
  const tokens = text.toLowerCase().split(/\s+/);

  // Simple word to ID mapping (placeholder - use actual BERT vocab)
  const tokenIds = tokens.slice(0, targetLength).map((token) => {
    // TODO: This is a placeholder - use real BERT tokenizer
    return token.charCodeAt(0) % 30000; // Mock token ID
  });

  // Pad to targetLength
  while (tokenIds.length < targetLength) {
    tokenIds.push(0); // PAD token
  }

  return useInt32 ? new Int32Array(tokenIds) : new Float32Array(tokenIds);
};

const buildBertInputs = (
  text: string,
  model?: TensorflowModel | null,
): (Int32Array | Float32Array)[] => {
  const { length, type } = getTextInputSpec(model);
  const ids = preprocessText(text, length, type === "int32");

  // Attention mask: 1 for real tokens (non-zero ids), else 0
  const maskArray = Array.from(ids).map((v) => (v === 0 ? 0 : 1));
  const mask =
    type === "int32" ? new Int32Array(maskArray) : new Float32Array(maskArray);

  // Segment ids (single sentence -> all zeros)
  const segmentArray = new Array(length).fill(0);
  const segments =
    type === "int32"
      ? new Int32Array(segmentArray)
      : new Float32Array(segmentArray);

  if (model?.inputs?.length && model.inputs.length >= 3) {
    return [ids, mask, segments];
  }

  // If single-input model, only send ids
  return [ids];
};

const getTextInputSpec = (model?: TensorflowModel | null) => {
  const fallbackLength = 128;
  const fallbackType: "float32" | "int32" = "int32";

  if (!model || !model.inputs || model.inputs.length === 0) {
    console.warn("[TFLite][text] inputs unavailable; using fallback spec");
    return { length: fallbackLength, type: fallbackType };
  }

  const first = model.inputs[0];
  const shape = Array.isArray(first.shape) ? first.shape : [];
  const length =
    shape.length >= 2
      ? shape.slice(1).reduce((a, b) => a * b, 1)
      : fallbackLength;
  const type = (first.dataType as "float32" | "int32") ?? fallbackType;

  console.log("[TFLite][text] input spec", {
    inputsLength: model.inputs.length,
    shapes: model.inputs.map((i) => i.shape),
    dtypes: model.inputs.map((i) => i.dataType),
    inferredSeqLength: length,
    inferredType: type,
  });

  return { length, type };
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

/**
 * Run inference on text input using MobileBERT
 */
const analyzeText = async (
  text: string,
  textModel?: TensorflowModel | null,
): Promise<AnalysisResult> => {
  try {
    const model = textModel;
    return fallbackTextAnalysis(text);
    // if (!model) return fallbackTextAnalysis(text);

    // // Build tensors for either single-input or multi-input BERT (ids, mask, segments)
    // const inputTensors = buildBertInputs(text, model);

    // // Run inference
    // const outputs = await model.run(inputTensors);

    // console.log("[TFLite][text] before fallback", outputs);

    // if (!outputs || outputs.length === 0) {
    // 	return fallbackTextAnalysis(text);
    // }

    // // Parse output
    // // Assuming output is [batch, num_classes]
    // const output = outputs[0] as Float32Array;
    // const predictions = Array.from(output);

    // console.log(
    // 	"[TFLite][text] output shape",
    // 	output.length,
    // 	"first5",
    // 	predictions.slice(0, 5),
    // );

    // // Get top prediction
    // const maxIndex = predictions.indexOf(Math.max(...predictions));

    // console.log(maxIndex, predictions[maxIndex]);
    // const confidence = predictions[maxIndex];

    // // Map index to condition (this mapping depends on your model)
    // const conditionMap = [
    // 	"chest_pain",
    // 	"bleeding",
    // 	"fracture",
    // 	"burn",
    // 	"unconscious",
    // 	"breathing",
    // 	"headache",
    // 	"fever",
    // 	"general",
    // ];
    // const condition = conditionMap[maxIndex] || "general";

    // // Determine severity based on condition and confidence
    // const severity = determineSeverityFromCondition(condition, confidence);

    // return {
    // 	condition,
    // 	severity,
    // 	confidence,
    // 	symptoms: extractSymptoms(text),
    // };
  } catch (error) {
    console.error("Text analysis error:", error);
    return fallbackTextAnalysis(text);
  }
};

/**
 * Run inference on image input using MobileNet
 */
const analyzeImage = async (
  imageUri: string,
  imageModel?: TensorflowModel | null,
): Promise<AnalysisResult> => {
  try {
    const model = imageModel;
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
    "chest pain",
    "shortness of breath",
    "difficulty breathing",
    "not breathing",
    "breathing",
    "bleeding",
    "severe bleeding",
    "blood",
    "fracture",
    "broken",
    "burn",
    "unconscious",
    "unresponsive",
    "fainted",
    "head injury",
    "seizure",
    "choking",
    "allergic",
    "rash",
    "swelling",
    "fever",
    "vomiting",
    "nausea",
    "dizziness",
    "weakness",
    "numbness",
    "confusion",
    "pain",
    "wound",
    "bruise",
    "sprain",
  ];

  const lowerText = text.toLowerCase();
  return symptomKeywords.filter((symptom) => lowerText.includes(symptom));
};

/**
 * Fallback analysis: rule-based triage when model logits are unusable
 */
const fallbackTextAnalysis = (text: string): AnalysisResult => {
  const lowerText = text.toLowerCase();
  const symptoms = extractSymptoms(text);

  type Rule = {
    condition: string;
    severity: number;
    score: number;
    keywords: string[];
  };

  const rules: Rule[] = [
    {
      condition: "cardiac_arrest",
      severity: 5,
      score: 0,
      keywords: ["not breathing", "no pulse", "cardiac arrest"],
    },
    {
      condition: "chest_pain",
      severity: 5,
      score: 0,
      keywords: ["chest pain", "crushing chest", "pressure chest"],
    },
    {
      condition: "severe_bleeding",
      severity: 5,
      score: 0,
      keywords: [
        "severe bleeding",
        "massive bleeding",
        "bleeding a lot",
        "blood everywhere",
      ],
    },
    {
      condition: "unconscious",
      severity: 5,
      score: 0,
      keywords: ["unconscious", "unresponsive", "passed out", "fainted"],
    },
    {
      condition: "difficulty_breathing",
      severity: 4,
      score: 0,
      keywords: [
        "difficulty breathing",
        "shortness of breath",
        "wheezing",
        "cannot breathe",
      ],
    },
    {
      condition: "stroke",
      severity: 5,
      score: 0,
      keywords: ["stroke", "face droop", "weak arm", "slurred speech", "FAST"],
    },
    {
      condition: "head_injury",
      severity: 4,
      score: 0,
      keywords: ["head injury", "head trauma", "hit head", "concussion"],
    },
    {
      condition: "fracture",
      severity: 3,
      score: 0,
      keywords: ["fracture", "broken", "bone", "break"],
    },
    {
      condition: "burn",
      severity: 3,
      score: 0,
      keywords: ["burn", "burned", "scalded"],
    },
    {
      condition: "seizure",
      severity: 4,
      score: 0,
      keywords: ["seizure", "convulsion", "fitting"],
    },
    {
      condition: "allergic_reaction",
      severity: 4,
      score: 0,
      keywords: ["allergic", "anaphylaxis", "swelling", "hives"],
    },
    {
      condition: "fever",
      severity: 2,
      score: 0,
      keywords: ["fever", "temperature", "hot"],
    },
    {
      condition: "sprain",
      severity: 2,
      score: 0,
      keywords: ["sprain", "strain", "twisted"],
    },
    {
      condition: "general",
      severity: 2,
      score: 0,
      keywords: ["pain", "ache", "hurt"],
    },
  ];

  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (lowerText.includes(kw)) {
        rule.score += 1;
      }
    }
  }

  const best = rules.sort(
    (a, b) => b.score - a.score || b.severity - a.severity,
  )[0];

  const condition = best.score > 0 ? best.condition : symptoms[0] || "general";
  const severity = best.score > 0 ? best.severity : 2;
  const confidence = best.score > 0 ? Math.min(1, 0.5 + best.score * 0.1) : 0.5;

  return {
    condition: condition.replace(/\s+/g, "_"),
    severity,
    confidence,
    symptoms,
  };
};

/**
 * Main analysis function - handles both text and image inputs
 */
export const analyzeUserInput = async (
  input: AnalysisInput,
  options?: AnalysisOptions,
): Promise<AnalysisResult> => {
  try {
    // Initialize models if not already done (non-blocking)
    if (!modelsInitialized) {
      initializeModels().catch((err) =>
        console.warn("Model initialization failed, using fallback:", err),
      );
    }

    if (input.imageUri) {
      return await analyzeImage(input.imageUri, options?.imageModel);
    } else if (input.text) {
      return await analyzeText(input.text, options?.textModel);
    } else {
      throw new Error("No input provided");
    }
  } catch (error) {
    console.error("Analysis error:", error);
    throw error;
  }
};
