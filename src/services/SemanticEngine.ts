import { Asset } from "expo-asset";
import { loadTensorflowModel, TensorflowModel } from "react-native-fast-tflite";
import anchorsData from "../assets/models/all-MiniLM-L6-v2/anchors.json";
import { tokenizeWordPiece } from "../utils/TokenizerUtils";

// The Sentence Transformer (MiniLM-L6) always uses 256 or 128 as fixed input length
const MAX_SEQ_LEN = 256;

export interface AIResult {
  tag: string;
  confidence: number;
}

class SemanticEngine {
  private model: TensorflowModel | null = null;
  private anchors: Record<string, number[]> = anchorsData;

  async initialize() {
    if (this.model) return;
    try {
      const modelAsset = Asset.fromModule(
        require("../assets/models/all-MiniLM-L6-v2.tflite"),
      );
      await modelAsset.downloadAsync();
      this.model = await loadTensorflowModel({ url: modelAsset.localUri! });
      console.log("✅ Semantic Engine Initialized");
    } catch (e) {
      console.error("❌ Failed to load Semantic Model", e);
    }
  }

  async identifyMedicalIntent(rawText: string): Promise<AIResult> {
    if (!this.model) await this.initialize();

    // 1. Convert text to WordPiece IDs (standard for BERT/MiniLM models)
    const { inputIds, attentionMask } = tokenizeWordPiece(rawText, MAX_SEQ_LEN);

    // 2. Run Inference
    // Sentence Transformers usually take 3 inputs: ids, mask, and type_ids
    const output = await this.model!.run([
      new Int32Array(inputIds),
      new Int32Array(attentionMask),
      new Int32Array(MAX_SEQ_LEN).fill(0),
    ]);

    // 3. Extract the embedding vector (the "meaning" of the sentence)
    const userVector = output[0] as Float32Array;

    // 4. Compare user vector against your 52 anchors using Cosine Similarity
    let bestMatch = { tag: "unknown", confidence: 0 };

    for (const [tag, anchorVector] of Object.entries(this.anchors)) {
      const similarity = this.cosineSimilarity(userVector, anchorVector);
      if (similarity > bestMatch.confidence) {
        bestMatch = { tag, confidence: similarity };
      }
    }

    return bestMatch;
  }

  private cosineSimilarity(
    vecA: Float32Array | number[],
    vecB: number[],
  ): number {
    let dotProduct = 0,
      normA = 0,
      normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export const semanticEngine = new SemanticEngine();
