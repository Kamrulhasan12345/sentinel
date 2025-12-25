import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// 1. Import your new high-performance services
import { Classifier } from "../services/ClassifierEngine";
import { FirstAidContent, KnowledgeBase } from "../services/KnowledgeBase";

import { SEVERITY_MAP, TriageLevel } from "@/constants/SeverityMap";
import { useVoiceToText } from "@/hooks/useVoiceToText";
import {
  ActivityIndicator,
  Card,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  imageUri?: string;
  firstAid?: FirstAidContent;
  triageLevel?: TriageLevel;
  confidence?: number;
}

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  // 2. Initialize the AI Engine on mount
  useEffect(() => {
    Classifier.initialize();
  }, []);

  const { isListening, startListening, stopListening } = useVoiceToText(
    (transcript) => {
      setInputText(transcript); // Fill the text box with what they said
    },
  );

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hello! I'm your medical assistant. Describe your symptoms for an immediate first-aid assessment.",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // Update the function signature
  const addMessage = (
    text: string,
    sender: "user" | "bot",
    imageUri?: string,
    firstAid?: FirstAidContent,
    triageLevel: TriageLevel = TriageLevel.ROUTINE,
    confidence?: number,
  ) => {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      sender,
      timestamp: new Date(),
      imageUri,
      firstAid,
      triageLevel,
      confidence,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = inputText.trim();
    setInputText("");
    addMessage(userMessage, "user");

    setIsLoading(true);

    try {
      // Inside handleSendMessage
      const prediction = await Classifier.predict(userMessage);
      const content = await KnowledgeBase.getValidatedContent(
        prediction.tag,
        prediction.confidence,
      );

      // Look up severity
      const severity = SEVERITY_MAP[prediction.tag] || TriageLevel.ROUTINE;

      if (content) {
        addMessage(
          `I've identified this as ${content.title}.`,
          "bot",
          undefined,
          content,
          severity,
          prediction.confidence,
        );
      } else {
        addMessage(
          "I'm not entirely sure about that. If it's an emergency, please call 911 immediately.",
          "bot",
        );
      }
    } catch (error) {
      console.error("Analysis error:", error);
      addMessage("System error. Please seek medical help if urgent.", "bot");
    } finally {
      setIsLoading(false);
    }
  };

  // const handleImagePick = async () => {
  //   // Request permissions
  //   const permissionResult =
  //     await ImagePicker.requestMediaLibraryPermissionsAsync();

  //   if (!permissionResult.granted) {
  //     addMessage(
  //       "Camera roll permissions are required to upload images.",
  //       "bot",
  //     );
  //     return;
  //   }

  //   // Launch image picker
  //   const result = await ImagePicker.launchImageLibraryAsync({
  //     mediaTypes: ImagePicker.MediaTypeOptions.Images,
  //     allowsEditing: true,
  //     quality: 0.8,
  //   });

  //   if (!result.canceled && result.assets[0]) {
  //     const imageUri = result.assets[0].uri;

  //     addMessage("Image uploaded", "user", imageUri);
  //     setIsLoading(true);
  //     addMessage("Analyzing image...", "bot");

  //     try {
  //       // Run AI inference on image
  //       const analysisResult = await analyzeUserInput(
  //         { imageUri },
  //         { imageModel: imageModelHook.model },
  //       );

  //       // Map to emergency protocol
  //       const protocol = getEmergencyProtocol(analysisResult);

  //       // Remove loading message
  //       setMessages((prev) => prev.slice(0, -1));

  //       // Add AI response with protocol
  //       addMessage(protocol.response, "bot", undefined, protocol);
  //     } catch (error) {
  //       console.error("Image analysis error:", error);
  //       setMessages((prev) => prev.slice(0, -1));
  //       addMessage(
  //         "Sorry, I encountered an error analyzing the image. Please try again.",
  //         "bot",
  //       );
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   }
  // };

  // const handleCameraCapture = async () => {
  //   // Request camera permissions
  //   const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

  //   if (!permissionResult.granted) {
  //     addMessage("Camera permissions are required to take photos.", "bot");
  //     return;
  //   }

  //   // Launch camera
  //   const result = await ImagePicker.launchCameraAsync({
  //     allowsEditing: true,
  //     quality: 0.8,
  //   });

  //   if (!result.canceled && result.assets[0]) {
  //     const imageUri = result.assets[0].uri;

  //     addMessage("Photo captured", "user", imageUri);
  //     setIsLoading(true);
  //     addMessage("Analyzing photo...", "bot");

  //     try {
  //       // Run AI inference on image
  //       const analysisResult = await analyzeUserInput(
  //         { imageUri },
  //         { imageModel: imageModelHook.model },
  //       );

  //       // Map to emergency protocol
  //       const protocol = getEmergencyProtocol(analysisResult);

  //       // Remove loading message
  //       setMessages((prev) => prev.slice(0, -1));

  //       // Add AI response with protocol
  //       addMessage(protocol.response, "bot", undefined, protocol);
  //     } catch (error) {
  //       console.error("Photo analysis error:", error);
  //       setMessages((prev) => prev.slice(0, -1));
  //       addMessage(
  //         "Sorry, I encountered an error analyzing the photo. Please try again.",
  //         "bot",
  //       );
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   }
  // };

  const renderMessage = (message: Message) => {
    const isUser = message.sender === "user";
    const getConfidenceColor = (score: number) => {
      if (score > 0.9) return "#4CAF50";
      if (score > 0.7) return "#FF9800";
      return "#F44336";
    };

    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.botMessageContainer,
        ]}
      >
        <Card
          style={[
            styles.messageCard,
            isUser ? styles.userMessageCard : styles.botMessageCard,
          ]}
        >
          <Card.Content>
            {message.imageUri && (
              <Image
                source={{ uri: message.imageUri }}
                style={styles.messageImage}
              />
            )}
            <Text
              variant="bodyMedium"
              style={isUser ? styles.userMessageText : styles.botMessageText}
            >
              {message.text}
            </Text>
            {/* Displaying your First Aid Instructions */}
            {message.firstAid && (
              <View style={styles.protocolContainer}>
                <Text style={styles.protocolTitle}>
                  {message.firstAid.title}
                </Text>
                <Text style={styles.protocolSteps}>
                  {message.firstAid.instructions
                    .map((step) => `• ${step}`)
                    .join("\n")}
                </Text>
                {/* --- ADD LIFE THREATENING STUFF HERE --- */}
                {message.triageLevel === TriageLevel.CRITICAL && (
                  <View style={styles.criticalActionContainer}>
                    {/* <View style={styles.divider} /> */}
                    <Text style={styles.emergencyWarningText}>
                      ⚠️ THIS IS A LIFE-THREATENING EMERGENCY
                    </Text>
                    <IconButton
                      icon="phone-outline"
                      mode="contained"
                      containerColor="#D32F2F"
                      iconColor="white"
                      size={30}
                      style={styles.emergencyButton}
                      onPress={() => Linking.openURL("tel:911")}
                    />
                    <Text style={styles.tapToCall}>
                      Tap to call Emergency Services
                    </Text>
                  </View>
                )}
              </View>
            )}
            {message.confidence && (
              <View style={styles.badgeContainer}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: getConfidenceColor(message.confidence) },
                  ]}
                />
                <Text style={styles.confidenceText}>
                  AI Confidence: {(message.confidence * 100).toFixed(1)}%
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map(renderMessage)}
      </ScrollView>

      <View
        style={[
          styles.inputContainer,
          { paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
        {/* --- IMAGE BUTTONS DISABLED/HIDDEN --- */}
        {/* <IconButton icon="camera" onPress={handleCameraCapture} disabled={isLoading} />
        <IconButton icon="image" onPress={handleImagePick} disabled={isLoading} /> 
        */}

        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Describe your emergency..."
          mode="outlined"
          disabled={isLoading}
          multiline
          onSubmitEditing={handleSendMessage}
        />
        <IconButton
          icon={isListening ? "microphone" : "microphone-outline"}
          mode={isListening ? "contained" : undefined}
          containerColor={isListening ? "#D32F2F" : undefined}
          iconColor={isListening ? "white" : "#666"}
          size={28}
          // logic: Press and hold to talk, release to finish
          onPressIn={startListening}
          onPressOut={stopListening}
        />
        {isLoading ? (
          <ActivityIndicator
            animating={true}
            size="small"
            style={styles.sendButton}
          />
        ) : (
          <IconButton
            icon="send"
            size={24}
            onPress={handleSendMessage}
            disabled={!inputText.trim()}
            iconColor={theme.colors.primary}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8 },
  messageContainer: { marginBottom: 12, maxWidth: "85%" },
  userMessageContainer: { alignSelf: "flex-end" },
  botMessageContainer: { alignSelf: "flex-start" },
  messageCard: { elevation: 2, borderRadius: 12 },
  userMessageCard: { backgroundColor: "#007AFF" },
  botMessageCard: { backgroundColor: "#ffffff" },
  userMessageText: { color: "#ffffff" },
  botMessageText: { color: "#000000" },
  messageImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
    resizeMode: "cover",
  },
  protocolContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  protocolTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 8,
    color: "#212529",
  },
  protocolSteps: { fontSize: 14, color: "#495057", lineHeight: 22 },
  emergencyWarning: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "bold",
    color: "#D32F2F",
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  textInput: { flex: 1, marginHorizontal: 8, maxHeight: 100 },
  sendButton: { marginLeft: 4 },
  criticalActionContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#FFEBEE", // Light red background
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D32F2F",
  },
  divider: {
    height: 1,
    backgroundColor: "#D32F2F",
    width: "100%",
    marginBottom: 10,
    opacity: 0.2,
  },
  emergencyWarningText: {
    color: "#D32F2F",
    fontWeight: "900",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 5,
  },
  emergencyButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  tapToCall: {
    color: "#D32F2F",
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 5,
  },
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  confidenceText: {
    fontSize: 10,
    color: "#666",
    fontWeight: "bold",
  },
});
