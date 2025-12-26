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
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{formatTag(item.tag)}</Text>
            <View
              style={[styles.severityDot, { backgroundColor: severityColor }]}
            />
          </View>
          <Text numberOfLines={1} style={styles.itemPreview}>
            {item.responses[0]}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
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
                  size={20}
                  color="#666"
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
    backgroundColor: "#ffffff",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
  },
  searchBar: {
    backgroundColor: "#f1f3f5",
    borderRadius: 24,
    height: 44,
  },
  searchBarInput: {
    minHeight: 44,
    fontSize: 15,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f3f5",
  },
  itemContent: {
    flex: 1,
    marginRight: 12,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    letterSpacing: -0.3,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  itemPreview: {
    fontSize: 13,
    color: "#8e8e93",
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
  },
  emptyText: {
    marginTop: 16,
    color: "#8e8e93",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modalTitle: {
    fontWeight: "700",
    fontSize: 17,
    letterSpacing: -0.4,
  },
  modalScroll: {
    padding: 24,
  },
  detailHeader: {
    marginBottom: 24,
  },
  detailTitle: {
    fontWeight: "800",
    fontSize: 32,
    color: "#1a1a1a",
    letterSpacing: -1,
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f3f5",
    marginBottom: 32,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontWeight: "700",
    marginBottom: 16,
    color: "#8e8e93",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 11,
  },
  instructionStep: {
    backgroundColor: "#f8f9fa",
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#1a1a1a",
  },
  patternContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  patternChip: {
    backgroundColor: "#f1f3f5",
    borderRadius: 8,
  },
  moreText: {
    alignSelf: "center",
    color: "#8e8e93",
    fontSize: 12,
    marginLeft: 4,
  },
  disclaimer: {
    flexDirection: "row",
    backgroundColor: "#fff5f5",
    padding: 20,
    borderRadius: 16,
    marginTop: 20,
    alignItems: "center",
    gap: 16,
  },
  disclaimerText: {
    flex: 1,
    color: "#ff3b30",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
});
