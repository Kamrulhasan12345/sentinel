import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import pluralize from "pluralize";
import { loadTensorflowModel, TensorflowModel } from "react-native-fast-tflite";
import { STOP_WORDS } from "../constants/StopWords";
import { Tokenizer } from "./Vocabulary";

const MAX_LEN = 15; // Must match your Python training code

class ClassifierEngine {
  private model: TensorflowModel | null = null;
  private labels: string[] = [];
  private isInitializing = false;

  /**
   * Loads the model and labels into memory.
   * Uses Expo Asset and FileSystem for high-speed local access.
   */
  async initialize() {
    if (this.model) return;
    if (this.isInitializing) {
      // Wait for existing initialization to complete
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    this.isInitializing = true;

    try {
      // 1. Load TFLite Model
      const modelAsset = Asset.fromModule(
        require("../assets/models/med_intent.tflite"),
      );
      await modelAsset.downloadAsync();
      this.model = await loadTensorflowModel({ url: modelAsset.localUri! });

      // 2. Load Labels
      const labelAsset = Asset.fromModule(
        require("../assets/models/labels.txt"),
      );
      await labelAsset.downloadAsync();
      const labelContent = await FileSystem.readAsStringAsync(
        labelAsset.localUri!,
      );
      this.labels = labelContent
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l !== "");

      console.log(
        `✅ Classifier Engine: Ready (${this.labels.length} labels loaded)`,
      );
    } catch (error) {
      console.error("❌ Failed to initialize Classifier:", error);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Cleans text to match the Python 'clean_text' function logic
   */
  private preprocess(text: string): number[] {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, "") // Remove punctuation
      .split(/\s+/)
      .filter((w) => w && !STOP_WORDS.has(w));
    console.log(`🧹 Cleaned text: "${words.join(" ")}"`);
    const tokens = words.map((w) =>
      Tokenizer.getWordToken(pluralize.singular(w)),
    );
    console.log(`🔢 Tokens: [${tokens.join(", ")}]`);
    return tokens;
  }

  /**
   * Runs the cleaned text through the 1D-CNN Model
   */
  async predict(rawText: string) {
    // Ensure model is initialized
    if (!this.model) {
      await this.initialize();
      if (!this.model) throw new Error("Model not initialized");
    }

    const tokens = this.preprocess(rawText);

    // Create a Float32Array for the Tensor (Zero-padded)
    // Create a 15-slot buffer of zeros
    const inputBuffer = new Float32Array(MAX_LEN).fill(0);

    // POST-PADDING: Words at the START, zeros at the END
    tokens.slice(0, MAX_LEN).forEach((token, i) => {
      inputBuffer[i] = token;
    });

    console.log("📐 Padded Tensor (POST):", Array.from(inputBuffer));

    // Run Inference
    console.log("🧠 Classifier: Running inference for:", rawText);
    const output = await this.model.run([inputBuffer]);
    const probabilities = output[0] as Float32Array;

    // Find the index of the highest confidence
    let maxIdx = 0;
    let maxConf = -1;
    for (let i = 0; i < probabilities.length; i++) {
      if (probabilities[i] > maxConf) {
        maxConf = probabilities[i];
        maxIdx = i;
      }
    }

    const result = {
      tag: this.labels[maxIdx],
      confidence: maxConf,
    };

    console.log("📊 Classifier Result:", result);
    console.log(
      "📈 All Probabilities:",
      Array.from(probabilities)
        .map((p, i) => `${this.labels[i]}: ${(p * 100).toFixed(2)}%`)
        .join(", "),
    );

    return result;
  }
}

// Export as a Singleton for the whole app
export const Classifier = new ClassifierEngine();
