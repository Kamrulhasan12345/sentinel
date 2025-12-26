import * as Haptics from "expo-haptics";
import { useNavigation } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  TextInput as RNTextInput,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// 1. Import your new high-performance services
import { ChatSessionMetadata, History } from "../services/HistoryService";
import { Classifier } from "../services/HybridEngine";
import { FirstAidContent, KnowledgeBase } from "../services/KnowledgeBase";

import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { SEVERITY_MAP, TriageLevel } from "@/constants/SeverityMap";
import { useVoiceToText } from "@/hooks/useVoiceToText";
import { useHeaderHeight } from "@react-navigation/elements";

import {
  ActivityIndicator,
  Chip,
  Divider,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";

const HUMANE_TEMPLATES = {
  [TriageLevel.CRITICAL]: [
    "Take a deep breath. This looks like {title}. Please follow these steps immediately.",
    "Stay calm. This appears to be {title}. Act on these instructions now.",
    "I'm here to help. This looks like {title}. Please follow these steps right away.",
  ],
  [TriageLevel.URGENT]: [
    "This sounds like {title}. You should seek medical attention soon. Here is what to do now:",
    "It looks like {title}. Professional help is recommended, but follow these steps in the meantime.",
    "Based on what you've said, this sounds like {title}. Here's how to handle it for now.",
  ],
  [TriageLevel.ROUTINE]: [
    "This sounds like {title}. Here is how you can manage it:",
    "It appears to be {title}. You can follow these steps for care:",
    "I can help with that. It sounds like {title}. Here's what you should do.",
  ],
  UNCERTAIN: [
    "I'm not 100% sure, but this might be {title}. If this doesn't feel right, please see a doctor.",
    "I'm having a bit of trouble being certain, but it could be {title}. Please use caution.",
  ],
};

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

const MessageItem = React.memo(({ message }: { message: Message }) => {
  const isUser = message.sender === "user";
  const triageLevel = message.triageLevel || TriageLevel.ROUTINE;

  const getConfidenceColor = (score: number) => {
    if (score > 0.65) return "#4CAF50";
    if (score > 0.5) return "#FF9800";
    return "#F44336";
  };

  return (
    <View
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

        <View style={styles.timestampRow}>
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
            AI Confidence: {(message.confidence * 100).toFixed(0)}%
          </Text>
        </View>
      )}
    </View>
  );
});

export default function ChatScreen() {
  const theme = useTheme();
  const colorScheme = useColorScheme() as "light" | "dark" | null;
  const appTheme = Colors[colorScheme ?? "light"];
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const flatListRef = useRef<any>(null);
  const navigation = useNavigation();

  // Pulse animation for recording
  const pulse = useSharedValue(0);
  const recordingStartTime = useRef<number>(0);
  const [showHoldMessage, setShowHoldMessage] = useState(false);
  const [isLegendVisible, setIsLegendVisible] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [sessions, setSessions] = useState<ChatSessionMetadata[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string>("New Assessment");
  const skipNextSave = useRef(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hello! I'm your medical assistant. Describe your symptoms for an immediate first-aid assessment.",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");

  const { isListening, startListening, stopListening } = useVoiceToText(
    (transcript) => {
      setInputText(transcript);
    },
  );

  const clearChat = () => {
    Alert.alert(
      "Clear Chat",
      "Are you sure you want to clear all messages?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            setMessages([
              {
                id: "1",
                text: "Hello! I'm your medical assistant. Describe your symptoms for an immediate first-aid assessment.",
                sender: "bot",
                timestamp: new Date(),
              },
            ]);
            setCurrentSessionId(null);
            setSessionTitle("New Assessment");
          },
        },
      ],
      { cancelable: true },
    );
  };

  const loadHistory = async () => {
    const allSessions = await History.getAllSessions();
    setSessions(allSessions);
    setIsHistoryVisible(true);
  };

  const selectSession = async (id: string) => {
    const session = await History.loadSession(id);
    if (session) {
      // Convert ISO strings back to Date objects
      const formattedMessages = session.messages.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
      skipNextSave.current = true;
      setMessages(formattedMessages);
      setCurrentSessionId(session.id);
      setSessionTitle(session.title);
      setIsHistoryVisible(false);
    }
  };

  const deleteSession = async (id: string) => {
    await History.deleteSession(id);
    const allSessions = await History.getAllSessions();
    setSessions(allSessions);
    if (currentSessionId === id) {
      clearChat();
    }
  };

  const renameSession = (id: string, currentTitle: string) => {
    setRenameId(id);
    setNewTitle(currentTitle);
    setIsRenameModalVisible(true);
  };

  const handleRenameSave = async () => {
    if (renameId && newTitle.trim()) {
      await History.renameSession(renameId, newTitle.trim());
      const allSessions = await History.getAllSessions();
      setSessions(allSessions);
      if (currentSessionId === renameId) setSessionTitle(newTitle.trim());
      setIsRenameModalVisible(false);
      setRenameId(null);
      setNewTitle("");
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <IconButton
            icon="plus"
            iconColor={theme.colors.primary}
            onPress={() => {
              clearChat();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          />
          <IconButton icon="history" iconColor="#666" onPress={loadHistory} />
        </View>
      ),
    });
  }, [navigation, currentSessionId, theme]);

  // Auto-save effect
  useEffect(() => {
    if (messages.length > 1) {
      if (skipNextSave.current) {
        skipNextSave.current = false;
        return;
      }

      const save = async () => {
        if (!currentSessionId) {
          const sessionId = Date.now().toString();
          // Use first user message as title
          const firstUserMsg = messages.find((m) => m.sender === "user");
          const title = firstUserMsg
            ? firstUserMsg.text.slice(0, 30) +
            (firstUserMsg.text.length > 30 ? "..." : "")
            : "Emergency Assessment";
          setCurrentSessionId(sessionId);
          setSessionTitle(title);
          return;
        }

        await History.saveSession({
          id: currentSessionId,
          title: sessionTitle,
          createdAt: messages[0].timestamp.toISOString(),
          updatedAt: new Date().toISOString(),
          lastMessage: messages[messages.length - 1].text,
          messages: messages,
        });
      };
      save();
    }
  }, [messages, currentSessionId, sessionTitle]);

  useEffect(() => {
    History.initialize();
  }, []);

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

  const [isLoading, setIsLoading] = useState(false);
  const [inputHeight, setInputHeight] = useState(0);

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
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

    const isFirstMessage = messages.length === 0;
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
        // Select template category
        const isUncertain = prediction.confidence < 0.7;
        const templates = isUncertain
          ? HUMANE_TEMPLATES.UNCERTAIN
          : HUMANE_TEMPLATES[severity];

        // Pick random template
        const template =
          templates[Math.floor(Math.random() * templates.length)];
        let responseText = template.replace("{title}", content.title);

        // Add supportive prefix for first critical message
        if (isFirstMessage && severity === TriageLevel.CRITICAL) {
          responseText = "Stay calm, I'm here to help. " + responseText;
        }

        addMessage(
          responseText,
          "bot",
          undefined,
          content,
          severity,
          prediction.confidence,
        );
      } else {
        addMessage(
          "I'm really sorry, but I can't identify that based on the description. If this is an emergency, please call 999 immediately. Otherwise, you can try describing the symptoms differently or check the Medical Library.",
          "bot",
        );
      }
    } catch (error) {
      console.error("Analysis error:", error);
      addMessage(
        "I'm sorry, I've encountered a technical problem. If this is urgent, please seek medical help immediately.",
        "bot",
      );
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

  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.container}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageItem message={item} />}
        contentContainerStyle={[
          styles.messagesContent,
          {
            paddingBottom: 16, // Match message margin for consistent spacing
          },
        ]}
        ListHeaderComponent={
          <View style={styles.legendContainer}>
            <Chip
              icon="information-outline"
              onPress={() => setIsLegendVisible(true)}
              style={styles.legendChip}
              textStyle={styles.legendChipText}
            >
              Triage Guide
            </Chip>
          </View>
        }
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />
      <View
        onLayout={(e) => setInputHeight(e.nativeEvent.layout.height)}
        style={[
          styles.inputWrapper,
          {
            paddingBottom: insets.bottom + 12,
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
              <Animated.View style={[styles.pulseCircle, animatedPulseStyle]} />
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

      <Modal
        visible={isLegendVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsLegendVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.legendModalContent}>
            <View style={styles.legendModalHeader}>
              <Text variant="titleLarge" style={styles.legendModalTitle}>
                Triage Guide
              </Text>
              <IconButton
                icon="close"
                size={20}
                onPress={() => setIsLegendVisible(false)}
              />
            </View>
            <Divider />
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#D32F2F" }]}
              />
              <View style={styles.legendTextContainer}>
                <Text style={styles.legendLabel}>CRITICAL</Text>
                <Text style={styles.legendDescription}>
                  Life-threatening emergency. Call emergency services
                  immediately.
                </Text>
              </View>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#F57C00" }]}
              />
              <View style={styles.legendTextContainer}>
                <Text style={styles.legendLabel}>URGENT</Text>
                <Text style={styles.legendDescription}>
                  Serious condition. Requires professional medical attention
                  soon.
                </Text>
              </View>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#388E3C" }]}
              />
              <View style={styles.legendTextContainer}>
                <Text style={styles.legendLabel}>ROUTINE</Text>
                <Text style={styles.legendDescription}>
                  Minor injury or condition. Can be managed with standard first
                  aid.
                </Text>
              </View>
            </View>
            <Text style={styles.legendDisclaimer}>
              Note: AI assessments are for guidance only. Always trust your
              instincts and seek professional help if unsure.
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isHistoryVisible}
        animationType="slide"
        onRequestClose={() => setIsHistoryVisible(false)}
      >
        <SafeAreaView style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <IconButton
              icon="chevron-down"
              size={28}
              onPress={() => setIsHistoryVisible(false)}
            />
            <Text variant="headlineSmall" style={styles.historyTitle}>
              History
            </Text>
            <IconButton
              icon="delete-sweep-outline"
              iconColor="#D32F2F"
              onPress={() => {
                Alert.alert(
                  "Clear All History",
                  "This action cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Clear All",
                      style: "destructive",
                      onPress: async () => {
                        await History.deleteAllSessions();
                        setSessions([]);
                        clearChat();
                      },
                    },
                  ],
                );
              }}
            />
          </View>

          <FlatList
            data={sessions}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.historyList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.historyItem}
                onPress={() => selectSession(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.accentBar} />
                <View style={styles.historyItemContent}>
                  <View style={styles.historyItemHeader}>
                    <Text style={styles.historyItemTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.historyItemDate}>
                      {new Date(item.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </View>
                  <Text style={styles.historyItemPreview} numberOfLines={1}>
                    {item.lastMessage || "No messages yet"}
                  </Text>
                </View>
                <View style={styles.historyItemActions}>
                  <IconButton
                    icon="pencil-outline"
                    size={20}
                    onPress={() => renameSession(item.id, item.title)}
                  />
                  <IconButton
                    icon="delete-outline"
                    size={20}
                    iconColor="#D32F2F"
                    onPress={() => deleteSession(item.id)}
                  />
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyHistory}>
                <IconButton
                  icon="message-off-outline"
                  size={64}
                  iconColor="#ccc"
                />
                <Text style={styles.emptyHistoryText}>No history found</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Rename Modal */}
      <Modal
        visible={isRenameModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsRenameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.renameModalContent}>
            <Text variant="titleLarge" style={styles.modalTitle}>
              Rename Assessment
            </Text>
            <RNTextInput
              style={styles.renameInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter new title"
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setIsRenameModalVisible(false)}
                style={styles.modalButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRenameSave}
                style={[styles.modalButton, styles.saveButton]}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 16 },
  messageContainer: { marginBottom: 16, maxWidth: "85%" },
  userMessageContainer: { alignSelf: "flex-end" },
  botMessageContainer: { alignSelf: "flex-start" },
  messageBubble: {
    padding: 14,
    borderRadius: 12,
    elevation: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  userBubble: {
    backgroundColor: "#007AFF",
    borderBottomRightRadius: 2,
  },
  botBubble: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: "#f1f3f5",
  },
  userText: { color: "#ffffff", fontSize: 16, lineHeight: 22 },
  botText: { color: "#212529", fontSize: 16, lineHeight: 22 },
  timestamp: {
    fontSize: 10,
    marginTop: 6,
    opacity: 0.5,
    fontWeight: "600",
  },
  userTimestamp: { color: "#ffffff", textAlign: "right" },
  botTimestamp: { color: "#adb5bd", textAlign: "left" },
  messageImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 10,
    resizeMode: "cover",
  },
  protocolContainer: {
    marginTop: 14,
    padding: 16,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  protocolTitle: {
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 8,
    color: "#212529",
    letterSpacing: -0.3,
  },
  protocolSteps: {
    fontSize: 15,
    color: "#495057",
    lineHeight: 22,
    marginBottom: 4,
  },
  timestampRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  copyButton: {
    margin: 0,
    marginLeft: 6,
  },
  copiedLabel: {
    fontSize: 12,
    color: "#6c757d",
    marginLeft: 6,
    fontWeight: "700",
  },
  inputWrapper: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#f1f3f5",
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#f1f3f5",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 4,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#212529",
    maxHeight: 120,
    paddingHorizontal: 14,
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
    borderRadius: 12,
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
    marginTop: 16,
    padding: 20,
    backgroundColor: "#fff5f5",
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ffe3e3",
  },
  divider: {
    height: 1,
    backgroundColor: "#ffe3e3",
    width: "100%",
    marginVertical: 12,
  },
  emergencyWarningText: {
    color: "#e03131",
    fontWeight: "800",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
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
  legendContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  legendChip: {
    backgroundColor: "#e9ecef",
    height: 32,
  },
  legendChipText: {
    fontSize: 12,
    color: "#495057",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  legendModalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 24,
    width: "90%",
    maxWidth: 400,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
  },
  legendModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  legendModalTitle: {
    fontWeight: "800",
    fontSize: 22,
    color: "#212529",
  },
  legendItem: {
    flexDirection: "row",
    marginTop: 16,
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 16,
  },
  legendTextContainer: {
    flex: 1,
  },
  legendLabel: {
    fontWeight: "800",
    fontSize: 14,
    color: "#212529",
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  legendDescription: {
    fontSize: 13,
    color: "#6c757d",
    lineHeight: 18,
    fontWeight: "500",
  },
  legendDisclaimer: {
    marginTop: 24,
    fontSize: 11,
    color: "#adb5bd",
    fontStyle: "italic",
    textAlign: "center",
  },
  historyContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f3f5",
  },
  historyTitle: {
    fontWeight: "800",
    color: "#212529",
  },
  historyList: {
    padding: 20,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f1f3f5",
    overflow: "hidden",
    // Premium shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  accentBar: {
    width: 4,
    height: "100%",
    backgroundColor: "#007AFF",
  },
  historyItemContent: {
    flex: 1,
    padding: 16,
    paddingLeft: 12,
  },
  historyItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  historyItemTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#212529",
    flex: 1,
    marginRight: 12,
  },
  historyItemDate: {
    fontSize: 12,
    color: "#adb5bd",
    fontWeight: "600",
  },
  historyItemPreview: {
    fontSize: 14,
    color: "#6c757d",
    lineHeight: 20,
  },
  historyItemActions: {
    flexDirection: "row",
    marginLeft: 8,
  },
  emptyHistory: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 120,
    opacity: 0.5,
  },
  emptyHistoryText: {
    color: "#495057",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  renameModalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 24,
    width: "90%",
    maxWidth: 340,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  modalTitle: {
    fontWeight: "800",
    marginBottom: 20,
    textAlign: "center",
    color: "#212529",
  },
  renameInput: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: "#212529",
    borderWidth: 1,
    borderColor: "#e9ecef",
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 8,
  },
  saveButton: {
    backgroundColor: "#007AFF",
    marginLeft: 12,
  },
  cancelButtonText: {
    color: "#6c757d",
    fontWeight: "700",
    fontSize: 16,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
