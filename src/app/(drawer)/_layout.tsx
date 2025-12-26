import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Drawer } from "expo-router/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function DrawerLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          drawerActiveTintColor: Colors[colorScheme ?? "light"].tint,
        }}
      >
        <Drawer.Screen
          name="index"
          options={{
            drawerLabel: "Chat",
            title: "Sentinel",
          }}
        />
        <Drawer.Screen
          name="library"
          options={{
            drawerLabel: "Medical Library",
            title: "Library",
            drawerIcon: ({ color, size }) => (
              <FontAwesome name="book" size={size} color={color} />
            ),
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
