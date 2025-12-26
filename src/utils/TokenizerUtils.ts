
// const vocab = vocabData as Record<string, number>;

// export function tokenizeWordPiece(text: string, maxLen: number) {
//   const tokens = text.toLowerCase().split(/\s+/);
//   let inputIds: number[] = [vocab["[CLS]"]]; // Start with Classification token

//   for (const word of tokens) {
//     // Basic WordPiece logic: find longest sub-word in vocab
//     if (vocab[word]) {
//       inputIds.push(vocab[word]);
//     } else {
//       // Fallback for unknown words (simplified for mobile performance)
//       inputIds.push(vocab["[UNK]"]);
//     }
//   }

//   inputIds.push(vocab["[SEP]"]); // End with Separator token

//   // Padding to reach fixed MAX_SEQ_LEN
//   const attentionMask = new Array(maxLen).fill(0);
//   for (let i = 0; i < inputIds.length && i < maxLen; i++) {
//     attentionMask[i] = 1;
//   }

//   while (inputIds.length < maxLen) {
//     inputIds.push(vocab["[PAD]"] || 0);
//   }

//   return {
//     inputIds: inputIds.slice(0, maxLen),
//     attentionMask: attentionMask.slice(0, maxLen),
//   };
// }
