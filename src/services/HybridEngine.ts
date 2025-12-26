import { Classifier as CNNClassifier } from "./ClassifierEngine";
import { Classifier as STClassifier } from "./SemanticEngine";

/**
 * Hybrid AI System
 *
 * Logic:
 * 1. Attempt classification using the 1D-CNN (ClassifierEngine).
 * 2. If confidence > 65%, return CNN result immediately (faster).
 * 3. Otherwise, fallback to the Semantic Transformer (SemanticEngine) for deeper analysis.
 */
class HybridEngine {
  /**
   * Pre-warms both engines for immediate use.
   * Handles individual failures so one engine can still work if the other fails.
   */
  async initialize() {
    console.log("⚙️ Hybrid Engine: Initializing sub-engines...");
    const results = await Promise.allSettled([
      CNNClassifier.initialize(),
      STClassifier.initialize(),
    ]);

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `❌ ${index === 0 ? "CNN" : "ST"} Engine failed to load:`,
          result.reason,
        );
      }
    });
    console.log("✅ Hybrid Engine: Initialization attempt complete.");
  }

  async predict(rawText: string) {
    console.log("🔀 Hybrid Engine: Starting analysis...");
    let cnnResult = null;

    try {
      // 1. Try CNN Classifier first
      cnnResult = await CNNClassifier.predict(rawText);
      console.log(
        `📡 CNN Confidence: ${(cnnResult.confidence * 100).toFixed(2)}%`,
      );

      if (cnnResult.confidence > 0.65) {
        console.log("✅ CNN Confidence high enough (>65%). Using CNN result.");
        return cnnResult;
      }
      console.log(
        "⚠️ CNN Confidence low. Falling back to Semantic Transformer...",
      );
    } catch (error) {
      console.warn("⚠️ CNN Engine failed or unavailable:", error);
    }

    try {
      // 2. Fallback to Semantic Transformer
      const stResult = await STClassifier.predict(rawText);
      console.log(
        `📡 ST Confidence: ${(stResult.confidence * 100).toFixed(2)}%`,
      );
      return stResult;
    } catch (error) {
      console.error("❌ ST Engine failed or unavailable:", error);

      // Final fallback: If ST fails but we have a CNN result (even if low confidence), use it
      if (cnnResult) {
        console.log("🔄 ST failed, falling back to low-confidence CNN result.");
        return cnnResult;
      }
      throw error;
    }
  }
}

export const Classifier = new HybridEngine();
