import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

export async function getVocabContent(): Promise<string> {
  // 1. Get the asset reference
  const asset = Asset.fromModule(
    require("../assets/models/all-MiniLM-L6-v2/vocab.txt"),
  );

  // 2. Ensure it's available locally in the cache
  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error("Could not load vocab asset");
  }

  // 3. Read the actual text content
  return await FileSystem.readAsStringAsync(asset.localUri);
}
