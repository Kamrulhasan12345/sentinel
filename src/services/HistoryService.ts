import * as FileSystem from "expo-file-system/legacy";
import { HISTORY_CONFIG } from "../constants/Config";

export interface ChatSessionMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage: string;
}

export interface ChatSession extends ChatSessionMetadata {
  messages: any[];
}

class HistoryService {
  private readonly baseDir = `${FileSystem.documentDirectory}${HISTORY_CONFIG.STORAGE_DIR}`;
  private readonly indexFile = `${this.baseDir}index.json`;

  /**
   * Encryption Middleware Stubs
   * Future-proofed for adding real encryption later.
   */
  private encrypt(data: string): string {
    // TODO: Implement real encryption here
    return data;
  }

  private decrypt(data: string): string {
    // TODO: Implement real decryption here
    return data;
  }

  async initialize() {
    const dirInfo = await FileSystem.getInfoAsync(this.baseDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.baseDir, {
        intermediates: true,
      });
    }
    const indexInfo = await FileSystem.getInfoAsync(this.indexFile);
    if (!indexInfo.exists) {
      await this.saveIndex([]);
    }
  }

  private async getIndex(): Promise<ChatSessionMetadata[]> {
    try {
      const content = await FileSystem.readAsStringAsync(this.indexFile);
      return JSON.parse(this.decrypt(content));
    } catch (e) {
      return [];
    }
  }

  private async saveIndex(index: ChatSessionMetadata[]) {
    const content = this.encrypt(JSON.stringify(index));
    await FileSystem.writeAsStringAsync(this.indexFile, content);
  }

  async getAllSessions(): Promise<ChatSessionMetadata[]> {
    const index = await this.getIndex();
    return index.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  async loadSession(id: string): Promise<ChatSession | null> {
    try {
      const filePath = `${this.baseDir}${id}.json`;
      const content = await FileSystem.readAsStringAsync(filePath);
      return JSON.parse(this.decrypt(content));
    } catch (e) {
      console.error("Failed to load session:", e);
      return null;
    }
  }

  async saveSession(session: ChatSession) {
    await this.initialize();
    const index = await this.getIndex();

    // Update or Add to index
    const existingIdx = index.findIndex((s) => s.id === session.id);
    const metadata: ChatSessionMetadata = {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: new Date().toISOString(),
      lastMessage: session.messages[session.messages.length - 1]?.text || "",
    };

    if (existingIdx > -1) {
      index[existingIdx] = metadata;
    } else {
      // Enforce limit
      if (index.length >= HISTORY_CONFIG.MAX_SESSIONS) {
        const oldest = index.sort(
          (a, b) =>
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
        )[0];
        await this.deleteSession(oldest.id);
        index.shift();
      }
      index.push(metadata);
    }

    await this.saveIndex(index);

    // Save full session file
    const filePath = `${this.baseDir}${session.id}.json`;
    const content = this.encrypt(JSON.stringify(session));
    await FileSystem.writeAsStringAsync(filePath, content);
  }

  async deleteSession(id: string) {
    try {
      const filePath = `${this.baseDir}${id}.json`;
      await FileSystem.deleteAsync(filePath, { idempotent: true });

      const index = await this.getIndex();
      const newIndex = index.filter((s) => s.id !== id);
      await this.saveIndex(newIndex);
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  }

  async deleteAllSessions() {
    await FileSystem.deleteAsync(this.baseDir, { idempotent: true });
    await this.initialize();
  }

  async renameSession(id: string, newTitle: string) {
    const index = await this.getIndex();
    const sessionIdx = index.findIndex((s) => s.id === id);
    if (sessionIdx > -1) {
      index[sessionIdx].title = newTitle;
      await this.saveIndex(index);

      const session = await this.loadSession(id);
      if (session) {
        session.title = newTitle;
        const filePath = `${this.baseDir}${id}.json`;
        await FileSystem.writeAsStringAsync(
          filePath,
          this.encrypt(JSON.stringify(session)),
        );
      }
    }
  }
}

export const History = new HistoryService();
