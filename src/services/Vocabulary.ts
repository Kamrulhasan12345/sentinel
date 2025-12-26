import vocabData from "../assets/models/sentinel-cnn-v1/vocab.json";

const VOCAB: Record<string, number> = vocabData;
const OOV_TOKEN = VOCAB["<OOV>"] || 1;

export const Tokenizer = {
  getWordToken: (word: string): number => {
    return VOCAB[word] ?? OOV_TOKEN;
  },
};
