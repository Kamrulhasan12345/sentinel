import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Drawer } from "expo-router/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function DrawerLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          drawerActiveTintColor: theme.tint,
          drawerInactiveTintColor: theme.tabIconDefault,
          drawerStyle: {
            backgroundColor: theme.background,
            width: 280,
          },
          headerStyle: {
            backgroundColor: theme.card,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          },
          headerTitleStyle: {
            fontWeight: "800",
            fontSize: 18,
            color: theme.text,
          },
          drawerLabelStyle: {
            fontWeight: "600",
          },
          drawerItemStyle: {
            borderRadius: 12,
            marginHorizontal: 12,
            paddingHorizontal: 4,
          },
        }}
      >
        <Drawer.Screen
          name="index"
          options={{
            drawerLabel: "Chat",
            title: "Sentinel AI",
            drawerIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="chat-processing-outline"
                size={size}
                color={color}
              />
            ),
          }}
        />
        <Drawer.Screen
          name="library"
          options={{
            drawerLabel: "Library",
            title: "Sentinel Library",
            drawerIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="book-open-variant"
                size={size}
                color={color}
              />
            ),
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
