import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useTensorflowModel } from "react-native-fast-tflite";
import {
  ActivityIndicator,
  Card,
  IconButton,
  Paragraph,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { analyzeUserInput } from "../services/aiService";
import {
  EmergencyProtocol,
  getEmergencyProtocol,
} from "../services/triageService";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  imageUri?: string;
  protocol?: EmergencyProtocol;
}

export default function ChatScreen() {
  const theme = useTheme();
  const textModelHook = useTensorflowModel(
    require("../assets/models/mobilebert.tflite"),
  );
  const imageModelHook = useTensorflowModel(
    require("../assets/models/mobilenet_v2.tflite"),
  );
  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hello! I'm your medical assistant. Describe your symptoms or send an image for assessment.",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const addMessage = (
    text: string,
    sender: "user" | "bot",
    imageUri?: string,
    protocol?: EmergencyProtocol,
  ) => {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      sender,
      timestamp: new Date(),
      imageUri,
      protocol,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = inputText.trim();
    setInputText("");
    addMessage(userMessage, "user");

    setIsLoading(true);
    addMessage("Analyzing your input...", "bot");

    try {
      // Run AI inference
      const analysisResult = await analyzeUserInput(
        { text: userMessage },
        { textModel: textModelHook.model },
      );

      // Map to emergency protocol
      const protocol = getEmergencyProtocol(analysisResult);

      // Remove loading message
      setMessages((prev) => prev.slice(0, -1));

      // Add AI response with protocol
      addMessage(protocol.response, "bot", undefined, protocol);
    } catch (error) {
      console.error("Analysis error:", error);
      setMessages((prev) => prev.slice(0, -1));
      addMessage(
        "Sorry, I encountered an error analyzing your input. Please try again.",
        "bot",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleImagePick = async () => {
    // Request permissions
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      addMessage(
        "Camera roll permissions are required to upload images.",
        "bot",
      );
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri;

      addMessage("Image uploaded", "user", imageUri);
      setIsLoading(true);
      addMessage("Analyzing image...", "bot");

      try {
        // Run AI inference on image
        const analysisResult = await analyzeUserInput(
          { imageUri },
          { imageModel: imageModelHook.model },
        );

        // Map to emergency protocol
        const protocol = getEmergencyProtocol(analysisResult);

        // Remove loading message
        setMessages((prev) => prev.slice(0, -1));

        // Add AI response with protocol
        addMessage(protocol.response, "bot", undefined, protocol);
      } catch (error) {
        console.error("Image analysis error:", error);
        setMessages((prev) => prev.slice(0, -1));
        addMessage(
          "Sorry, I encountered an error analyzing the image. Please try again.",
          "bot",
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCameraCapture = async () => {
    // Request camera permissions
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      addMessage("Camera permissions are required to take photos.", "bot");
      return;
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri;

      addMessage("Photo captured", "user", imageUri);
      setIsLoading(true);
      addMessage("Analyzing photo...", "bot");

      try {
        // Run AI inference on image
        const analysisResult = await analyzeUserInput(
          { imageUri },
          { imageModel: imageModelHook.model },
        );

        // Map to emergency protocol
        const protocol = getEmergencyProtocol(analysisResult);

        // Remove loading message
        setMessages((prev) => prev.slice(0, -1));

        // Add AI response with protocol
        addMessage(protocol.response, "bot", undefined, protocol);
      } catch (error) {
        console.error("Photo analysis error:", error);
        setMessages((prev) => prev.slice(0, -1));
        addMessage(
          "Sorry, I encountered an error analyzing the photo. Please try again.",
          "bot",
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  const renderMessage = (message: Message) => {
    const isUser = message.sender === "user";

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
                resizeMode="cover"
              />
            )}
            <Paragraph
              style={isUser ? styles.userMessageText : styles.botMessageText}
            >
              {message.text}
            </Paragraph>

            {message.protocol && (
              <View style={styles.protocolContainer}>
                <Text style={styles.protocolTitle}>
                  Triage Level: {message.protocol.level}
                </Text>
                {message.protocol.condition && (
                  <Text style={styles.protocolCondition}>
                    Condition: {message.protocol.condition}
                  </Text>
                )}
                <Text style={styles.protocolSteps}>
                  {message.protocol.steps.join("\n• ")}
                </Text>
                {message.protocol.shouldCallEmergency && (
                  <Text style={styles.emergencyWarning}>
                    ⚠️ CALL EMERGENCY SERVICES IMMEDIATELY
                  </Text>
                )}
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
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.map(renderMessage)}
      </ScrollView>

      <View style={styles.inputContainer}>
        <IconButton
          icon="camera"
          size={24}
          onPress={handleCameraCapture}
          disabled={isLoading}
          iconColor={theme.colors.primary}
        />
        <IconButton
          icon="image"
          size={24}
          onPress={handleImagePick}
          disabled={isLoading}
          iconColor={theme.colors.primary}
        />
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Describe your symptoms..."
          mode="outlined"
          disabled={isLoading}
          multiline
          maxLength={500}
          onSubmitEditing={handleSendMessage}
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
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: "80%",
  },
  userMessageContainer: {
    alignSelf: "flex-end",
  },
  botMessageContainer: {
    alignSelf: "flex-start",
  },
  messageCard: {
    elevation: 2,
  },
  userMessageCard: {
    backgroundColor: "#007AFF",
  },
  botMessageCard: {
    backgroundColor: "#ffffff",
  },
  userMessageText: {
    color: "#ffffff",
  },
  botMessageText: {
    color: "#000000",
  },
  messageImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  protocolContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#FFF3CD",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#FFC107",
  },
  protocolTitle: {
    fontWeight: "bold",
    fontSize: 14,
    marginBottom: 8,
    color: "#856404",
  },
  protocolCondition: {
    fontSize: 13,
    marginBottom: 8,
    color: "#856404",
    fontWeight: "600",
  },
  protocolSteps: {
    fontSize: 12,
    color: "#856404",
    lineHeight: 18,
  },
  emergencyWarning: {
    marginTop: 8,
    fontSize: 13,
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
  textInput: {
    flex: 1,
    marginHorizontal: 4,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 4,
  },
});
