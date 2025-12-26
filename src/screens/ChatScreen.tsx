import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  TextInput as RNTextInput,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 1. Import your new high-performance services
import { Classifier } from "../services/HybridEngine";
import { FirstAidContent, KnowledgeBase } from "../services/KnowledgeBase";

import { SEVERITY_MAP, TriageLevel } from "@/constants/SeverityMap";
import { useVoiceToText } from "@/hooks/useVoiceToText";
import { useHeaderHeight } from "@react-navigation/elements";

import {
  ActivityIndicator,
  IconButton,
  Text,
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
  const headerHeight = useHeaderHeight();
  const scrollViewRef = useRef<ScrollView>(null);

  // Pulse animation for recording
  const pulse = useSharedValue(0);
  const recordingStartTime = useRef<number>(0);
  const [showHoldMessage, setShowHoldMessage] = useState(false);

  const { isListening, startListening, stopListening } = useVoiceToText(
    (transcript) => {
      setInputText(transcript);
    },
  );

  useEffect(() => {
    if (isListening) {
      pulse.value = withRepeat(withTiming(1, { duration: 1000 }), -1, false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else {
      pulse.value = withTiming(0);
    }
  }, [isListening]);

  const handleStartListening = () => {
    recordingStartTime.current = Date.now();
    setShowHoldMessage(false);
    startListening();
  };

  const handleStopListening = () => {
    const duration = Date.now() - recordingStartTime.current;
    stopListening();
    if (duration < 500) {
      setShowHoldMessage(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setTimeout(() => setShowHoldMessage(false), 2000);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const animatedPulseStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 2]) }],
      opacity: interpolate(pulse.value, [0, 1], [0.5, 0]),
    };
  });

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
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputHeight, setInputHeight] = useState(0);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates?.height || 0);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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
    const triageLevel = message.triageLevel || TriageLevel.ROUTINE;

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
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.botBubble,
          ]}
        >
          {message.imageUri && (
            <Image
              source={{ uri: message.imageUri }}
              style={styles.messageImage}
            />
          )}
          <Text style={isUser ? styles.userText : styles.botText}>
            {message.text}
          </Text>

          {message.firstAid && (
            <View style={styles.protocolContainer}>
              <Text style={styles.protocolTitle}>{message.firstAid.title}</Text>
              {message.firstAid.instructions.map((step, index) => (
                <Text key={index} style={styles.protocolSteps}>
                  • {step}
                </Text>
              ))}

              {message.triageLevel &&
                message.triageLevel !== TriageLevel.ROUTINE && (
                  <View style={styles.criticalActionContainer}>
                    <Text style={styles.emergencyWarningText}>
                      CRITICAL: {triageLevel.toUpperCase()}
                    </Text>
                    <View style={styles.divider} />
                    <IconButton
                      icon="phone"
                      mode="contained"
                      containerColor="#D32F2F"
                      iconColor="white"
                      size={30}
                      style={styles.emergencyButton}
                      onPress={() => Linking.openURL("tel:999")}
                    />
                    <Text style={styles.tapToCall}>
                      Tap to call Emergency Services
                    </Text>
                  </View>
                )}
            </View>
          )}

          <Text
            style={[
              styles.timestamp,
              isUser ? styles.userTimestamp : styles.botTimestamp,
            ]}
          >
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        {message.confidence && !isUser && (
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
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={[
            styles.messagesContent,
            {
              paddingBottom: isKeyboardVisible
                ? keyboardHeight + Math.max(insets.bottom, 12)
                : Math.max(insets.bottom, 32),
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map(renderMessage)}
        </ScrollView>

        <View
          onLayout={(e) => setInputHeight(e.nativeEvent.layout.height)}
          style={[
            styles.inputWrapper,
            {
              paddingBottom:
                Platform.OS === "ios"
                  ? Math.max(insets.bottom, 8)
                  : Math.max(insets.bottom, 8),
            },
          ]}
        >
          <View style={styles.inputContainer}>
            <RNTextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              selectionColor="#007AFF"
              cursorColor="#007AFF"
              editable={!isLoading}
              multiline
            />

            <View style={styles.micContainer}>
              {showHoldMessage && (
                <View style={styles.holdTooltip}>
                  <Text style={styles.holdTooltipText} numberOfLines={1}>
                    Hold to Talk
                  </Text>
                </View>
              )}
              {isListening && (
                <Animated.View
                  style={[styles.pulseCircle, animatedPulseStyle]}
                />
              )}
              <IconButton
                icon={isListening ? "microphone" : "microphone-outline"}
                mode={isListening ? "contained" : undefined}
                containerColor={isListening ? "#D32F2F" : "transparent"}
                iconColor={isListening ? "white" : "#666"}
                size={24}
                onPressIn={handleStartListening}
                onPressOut={handleStopListening}
                style={styles.iconButton}
              />
            </View>

            {isLoading ? (
              <ActivityIndicator
                animating={true}
                size="small"
                style={styles.loader}
              />
            ) : (
              <IconButton
                icon="send"
                size={24}
                onPress={handleSendMessage}
                disabled={!inputText.trim()}
                iconColor={inputText.trim() ? "#007AFF" : "#ccc"}
                style={styles.iconButton}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 32 },
  messageContainer: { marginBottom: 16, maxWidth: "85%" },
  userMessageContainer: { alignSelf: "flex-end" },
  botMessageContainer: { alignSelf: "flex-start" },
  messageBubble: {
    padding: 12,
    borderRadius: 20,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  userBubble: {
    backgroundColor: "#007AFF",
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 4,
  },
  userText: { color: "#ffffff", fontSize: 16 },
  botText: { color: "#212529", fontSize: 16 },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    opacity: 0.6,
  },
  userTimestamp: { color: "#ffffff", textAlign: "right" },
  botTimestamp: { color: "#6c757d", textAlign: "left" },
  messageImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
    resizeMode: "cover",
  },
  protocolContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#f1f3f5",
    borderRadius: 12,
  },
  protocolTitle: {
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 6,
    color: "#212529",
  },
  protocolSteps: { fontSize: 14, color: "#495057", lineHeight: 20 },
  inputWrapper: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#f1f3f5",
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#f1f3f5",
    borderRadius: 22,
    paddingHorizontal: 4,
    paddingVertical: 2,
    minHeight: 44,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#212529",
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    textAlignVertical: "top",
  },
  iconButton: {
    margin: 0,
  },
  loader: {
    marginHorizontal: 12,
    marginBottom: 10,
  },
  micContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  pulseCircle: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(211, 47, 47, 0.4)",
  },
  holdTooltip: {
    position: "absolute",
    top: -45,
    backgroundColor: "#343a40",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 100,
    alignItems: "center",
  },
  holdTooltipText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  sendButton: { marginLeft: 4 },
  criticalActionContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#fff5f5",
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ffa8a8",
  },
  divider: {
    height: 1,
    backgroundColor: "#ffa8a8",
    width: "100%",
    marginVertical: 10,
  },
  emergencyWarningText: {
    color: "#e03131",
    fontWeight: "800",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
  },
  emergencyButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  tapToCall: {
    color: "#e03131",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 6,
  },
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    backgroundColor: "#e9ecef",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  confidenceText: {
    fontSize: 10,
    color: "#495057",
    fontWeight: "600",
  },
});
