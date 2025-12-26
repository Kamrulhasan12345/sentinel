import { SEVERITY_MAP, TriageLevel } from "@/constants/SeverityMap";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Chip,
  Divider,
  IconButton,
  Searchbar,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import intentsData from "../../assets/models/intents.json";

interface Intent {
  tag: string;
  patterns: string[];
  responses: string[];
}

export default function LibraryScreen() {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIntent, setSelectedIntent] = useState<Intent | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const intents = useMemo(() => {
    return (intentsData.intents as Intent[]).sort((a, b) =>
      a.tag.localeCompare(b.tag),
    );
  }, []);

  const filteredIntents = useMemo(() => {
    return intents.filter((intent) => {
      const title = intent.tag.replace(/_/g, " ").toLowerCase();
      return title.includes(searchQuery.toLowerCase());
    });
  }, [searchQuery, intents]);

  const getSeverityColor = (tag: string) => {
    const level = SEVERITY_MAP[tag] || TriageLevel.ROUTINE;
    switch (level) {
      case TriageLevel.CRITICAL:
        return "#D32F2F";
      case TriageLevel.URGENT:
        return "#F57C00";
      case TriageLevel.ROUTINE:
        return "#388E3C";
      default:
        return "#757575";
    }
  };

  const formatTag = (tag: string) => {
    return tag.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const handleOpenDetail = (intent: Intent) => {
    setSelectedIntent(intent);
    setIsModalVisible(true);
  };

  const renderItem = ({ item }: { item: Intent }) => {
    const severity = SEVERITY_MAP[item.tag] || TriageLevel.ROUTINE;
    const severityColor = getSeverityColor(item.tag);

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => handleOpenDetail(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.accentBar, { backgroundColor: severityColor }]} />
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{formatTag(item.tag)}</Text>
          </View>
          <Text numberOfLines={1} style={styles.itemPreview}>
            {item.responses[0]}
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color="#adb5bd"
          style={{ marginRight: 12 }}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="Search conditions..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchBarInput}
          iconColor="#666"
          placeholderTextColor="#999"
          elevation={0}
        />
      </View>

      <FlatList
        data={filteredIntents}
        keyExtractor={(item) => item.tag}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="medical-bag" size={64} color="#ccc" />
            <Text variant="bodyLarge" style={styles.emptyText}>
              No conditions found matching "{searchQuery}"
            </Text>
          </View>
        }
      />

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setIsModalVisible(false)}
            />
            <Text variant="titleLarge" style={styles.modalTitle}>
              Medical Protocol
            </Text>
            <View style={{ width: 48 }} />
          </View>

          {selectedIntent && (
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.detailHeader}>
                <Text variant="headlineMedium" style={styles.detailTitle}>
                  {formatTag(selectedIntent.tag)}
                </Text>
                <Chip
                  textStyle={{ color: "white" }}
                  style={{
                    backgroundColor: getSeverityColor(selectedIntent.tag),
                    alignSelf: "flex-start",
                    marginTop: 8,
                  }}
                >
                  {SEVERITY_MAP[selectedIntent.tag] || TriageLevel.ROUTINE}
                </Chip>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.section}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  First Aid Instructions
                </Text>
                {selectedIntent.responses.map((response, index) => (
                  <View key={index} style={styles.instructionStep}>
                    <Text variant="bodyLarge" style={styles.instructionText}>
                      {response}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.section}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Common Symptoms/Keywords
                </Text>
                <View style={styles.patternContainer}>
                  {selectedIntent.patterns
                    .slice(0, 10)
                    .map((pattern, index) => (
                      <Chip
                        key={index}
                        style={styles.patternChip}
                        textStyle={{ fontSize: 12 }}
                      >
                        {pattern}
                      </Chip>
                    ))}
                  {selectedIntent.patterns.length > 10 && (
                    <Text variant="bodySmall" style={styles.moreText}>
                      +{selectedIntent.patterns.length - 10} more...
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.disclaimer}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={24}
                  color="#e03131"
                />
                <Text variant="bodySmall" style={styles.disclaimerText}>
                  This information is for educational purposes only. In case of
                  a real emergency, call emergency services immediately.
                </Text>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f3f5",
  },
  searchBar: {
    backgroundColor: "#f1f3f5",
    borderRadius: 8,
    height: 48,
    elevation: 0,
  },
  searchBarInput: {
    minHeight: 48,
    fontSize: 16,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f1f3f5",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  accentBar: {
    width: 4,
    height: "100%",
  },
  itemContent: {
    flex: 1,
    padding: 16,
    paddingLeft: 12,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#212529",
    letterSpacing: -0.4,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
  itemPreview: {
    fontSize: 14,
    color: "#6c757d",
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 120,
    opacity: 0.5,
  },
  emptyText: {
    marginTop: 16,
    color: "#495057",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f3f5",
  },
  modalTitle: {
    fontWeight: "800",
    fontSize: 18,
    color: "#212529",
  },
  modalScroll: {
    padding: 24,
  },
  detailHeader: {
    marginBottom: 32,
  },
  detailTitle: {
    fontWeight: "800",
    fontSize: 34,
    color: "#212529",
    letterSpacing: -1.2,
    lineHeight: 40,
  },
  divider: {
    height: 1,
    backgroundColor: "#e9ecef",
    marginBottom: 32,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontWeight: "800",
    marginBottom: 16,
    color: "#adb5bd",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontSize: 12,
  },
  instructionStep: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f1f3f5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  instructionText: {
    fontSize: 16,
    lineHeight: 26,
    color: "#495057",
  },
  patternContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  patternChip: {
    backgroundColor: "#e9ecef",
    borderRadius: 12,
  },
  moreText: {
    alignSelf: "center",
    color: "#adb5bd",
    fontSize: 12,
    marginLeft: 4,
    fontWeight: "600",
  },
  disclaimer: {
    flexDirection: "row",
    backgroundColor: "#fff5f5",
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: "#ffe3e3",
  },
  disclaimerText: {
    flex: 1,
    color: "#e03131",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
});
