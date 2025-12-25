import intentsData from "../assets/models/intents.json";

export interface FirstAidContent {
  tag: string;
  title: string;
  instructions: string[];
  description?: string;
}

class KnowledgeBaseService {
  /**
   * Look up first-aid content by the tag returned from the AI.
   */
  getContentByTag(tag: string): FirstAidContent | null {
    console.log(`🔍 KnowledgeBase: Searching for tag: "${tag}"`);
    const intent = intentsData.intents.find((i) => i.tag === tag);

    if (!intent) {
      console.warn(`⚠️ KnowledgeBase: No content found for tag: ${tag}`);
      return null;
    }

    const content = {
      tag: intent.tag,
      // Formatting the tag (e.g., "heat_stroke" -> "Heat Stroke")
      title: intent.tag
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      instructions: intent.responses,
    };

    console.log(
      `✅ KnowledgeBase: Found content for "${tag}" (${content.instructions.length} steps)`,
    );
    return content;
  }

  /**
   * Safety Filter: Decide if the AI confidence is high enough to show content.
   */
  getValidatedContent(tag: string, confidence: number): FirstAidContent | null {
    const CONFIDENCE_THRESHOLD = 0.65; // 65% certainty required for medical advice

    if (confidence < CONFIDENCE_THRESHOLD) {
      console.log(
        `⚠️ KnowledgeBase: Confidence too low (${(confidence * 100).toFixed(
          1,
        )}% < ${(CONFIDENCE_THRESHOLD * 100).toFixed(0)}%). Filtering result.`,
      );
      return null;
    }

    return this.getContentByTag(tag);
  }
}

export const KnowledgeBase = new KnowledgeBaseService();
