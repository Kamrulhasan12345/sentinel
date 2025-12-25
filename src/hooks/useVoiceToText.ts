import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useCallback, useState } from "react";

export const useVoiceToText = (onResult: (text: string) => void) => {
  const [isListening, setIsListening] = useState(false);

  // Handle the results coming back from the OS
  useSpeechRecognitionEvent("result", (event) => {
    if (event.results[0]?.transcript) {
      onResult(event.results[0].transcript);
    }
  });

  useSpeechRecognitionEvent("start", () => setIsListening(true));
  useSpeechRecognitionEvent("end", () => setIsListening(false));

  const startListening = useCallback(async () => {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) return;

    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
    });
  }, []);

  const stopListening = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { isListening, startListening, stopListening };
};
