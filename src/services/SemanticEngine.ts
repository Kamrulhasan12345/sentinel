const BertWordPieceTokenizer = require("@nlpjs/bert-tokenizer/src/bert-word-piece-tokenizer.js");

import { Asset } from "expo-asset";
import { loadTensorflowModel, TensorflowModel } from "react-native-fast-tflite";
import anchorsData from "../assets/models/all-MiniLM-L6-v2/anchors.json";
import { getVocabContent } from "../utils/ST_Vocab";

// STRICT SPECS: 128 tokens
const MAX_SEQ_LEN = 128;

export interface AIResult {
  tag: string;
  confidence: number;
}

class SemanticEngine {
  private model: TensorflowModel | null = null;
  private anchors: Record<string, number[]> = anchorsData;
  private isInitializing = false;
  private tokenizer: any = null;
  // private tokenizerDir = `${FileSystem.documentDirectory}tokenizer/`;

  /**
   * PUBLIC API: Exactly matches your original ClassifierEngine.ts
   */
  async initialize() {
    if (this.model) return;
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    this.isInitializing = true;
    try {
      // const dirInfo = await FileSystem.getInfoAsync(this.tokenizerDir);
      // if (!dirInfo.exists) {
      //   await FileSystem.makeDirectoryAsync(this.tokenizerDir, {
      //     intermediates: true,
      //   });
      // }

      // 2. Map your local files to their require paths
      // const assetMap: Record<string, string> = {
      //   "tokenizer.json": "../assets/models/all-MiniLM-L6-v2/tokenizer.json",
      //   "config.json": "../assets/models/all-MiniLM-L6-v2/config.json",
      //   "special_tokens_map.json":
      //     "../assets/models/all-MiniLM-L6-v2/special_tokens_map.json",
      //   "tokenizer_config.json":
      //     "../assets/models/all-MiniLM-L6-v2/tokenizer_config.json",
      //   "vocab.txt": "../assets/models/all-MiniLM-L6-v2/vocab.txt",
      // };

      // // 3. Copy each asset from the bundle to the FileSystem
      // for (const [filename, module] of Object.entries(assetMap)) {
      //   console.log(`Processing file: ${filename}`);
      //   const asset = Asset.fromModule({
      //     url: module,
      //     width: null,
      //     height: null,
      //   });
      //   console.log(`Preparing asset: ${filename}`, asset);
      //   await asset.downloadAsync(); // Ensures it's available locally

      //   const targetPath = `${this.tokenizerDir}${filename}`;
      //   const fileCheck = await FileSystem.getInfoAsync(targetPath);

      //   console.log(`Checking file: ${targetPath}`, fileCheck);

      //   if (!fileCheck.exists) {
      //     // Copy from the internal asset URI to our accessible folder
      //     await FileSystem.copyAsync({ from: asset.localUri!, to: targetPath });
      //   }
      // }

      this.tokenizer = new BertWordPieceTokenizer({ lowercase: true });
      const vocabContent = await getVocabContent();
      this.tokenizer.loadDictionary(vocabContent);

      // 1. Load the Sentence Transformer TFLite Model
      const modelAsset = Asset.fromModule(
        require("../assets/models/all-MiniLM-L6-v2/sentence_transformer.tflite"),
      );
      await modelAsset.downloadAsync();
      this.model = await loadTensorflowModel({ url: modelAsset.localUri! });
      // this.tokenizer = new BertWordPieceTokenizer({ lowercase: true });
      // this.tokenizer.loadDictionary(vocabData);

      console.log("✅ Semantic Engine: Ready (Sentence Transformer Loaded)");
      // this.model = null;
      // this.isInitializing = false;
      // throw new Error("Forced error for testing");
    } catch (e) {
      console.error("❌ Failed to load Semantic Model", e);
      console.log(e);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * PUBLIC API: Exactly matches predict(rawText) from ClassifierEngine.ts
   */
  async predict(rawText: string): Promise<AIResult> {
    if (!this.model) {
      await this.initialize();
      if (!this.model) throw new Error("Model not initialized");
    }

    const encoded = this.tokenizer.encode(
      rawText,
      undefined,
      MAX_SEQ_LEN,
      MAX_SEQ_LEN,
    );

    // 2. Prepare Int32Arrays (required by TFLite for BERT models)
    const inputIds = new Int32Array(encoded.ids);
    const attentionMask = new Int32Array(encoded.attentionMask);
    // 2. Run Inference with 3 input tensors as per transformer specs
    // Inputs: [input_ids, attention_mask, token_type_ids]
    const output = await this.model!.run([
      new Int32Array(attentionMask),
      new Int32Array(inputIds),
      // new Int32Array(MAX_SEQ_LEN).fill(0), // Segment IDs / TokenTypeIds
    ]);

    // 3. Extract 384-dimensional Embedding
    const userVector = output[0] as Float32Array;

    console.log(
      `   Output Vector: [${Array.from(userVector)
        .slice(0, 10)
        .map((v) => v.toFixed(4))
        .join(", ")}... ] (total ${userVector.length} dims)`,
    );

    // 4. Vector Comparison (Dot Product for L2 Normalized vectors)
    let bestMatch = { tag: "unknown", confidence: 0 };

    for (const [tag, anchorVector] of Object.entries(this.anchors)) {
      const similarity = this.calculateDotProduct(userVector, anchorVector);

      if (similarity > bestMatch.confidence) {
        bestMatch = { tag, confidence: similarity };
      }
    }

    console.log(
      `📊 Semantic Result: ${bestMatch.tag} (${(bestMatch.confidence * 100).toFixed(2)}%)`,
    );
    return bestMatch;
  }

  /**
   * Efficient similarity check for normalized vectors
   */
  private calculateDotProduct(vecA: Float32Array, vecB: number[]): number {
    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
    }
    return dotProduct;
  }
}

// Export as a Singleton (matching your Classifier export)
export const Classifier = new SemanticEngine();
