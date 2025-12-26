import { Text, View } from "@/components/Themed";
import { useNavigation } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, StyleSheet } from "react-native";
import { IconButton } from "react-native-paper";

export default function ModalScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Information</Text>
        <IconButton
          icon="close"
          size={24}
          onPress={() => navigation.goBack()}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          Sentinel AI is your personal medical assistant. Always consult a
          professional for serious conditions.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Version</Text>
          <Text style={styles.cardValue}>1.0.0 (2025 Edition)</Text>
        </View>
      </View>

      <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#212529",
  },
  content: {
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: "#6c757d",
    lineHeight: 24,
    marginBottom: 30,
  },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f3f5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#adb5bd",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#212529",
  },
});
