<div align="center">
  <img src="assets/images/icon.png" alt="Sentinel Logo" width="120" />

# Sentinel

[![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TensorFlow](https://img.shields.io/badge/TensorFlow_Lite-FF6F00?style=flat-square&logo=tensorflow&logoColor=white)](https://www.tensorflow.org/lite)
[![Expo](https://img.shields.io/badge/Expo-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev/)

</div>

**Sentinel** is an offline-first, AI-powered medical triage application designed to provide immediate first-aid guidance. By leveraging a custom 1D-CNN model and a Sentence Transformers model optimized for mobile devices, it assesses symptoms in real-time to categorize emergencies and offer validated medical protocols without requiring an internet connection.

---

## ✨ Key Features

### 🧠 AI & Triage

- **Smart Severity Grading:** Automatically classifies incidents into **Critical**, **Urgent**, or **Routine** based on symptom description.
- **Hybrid Inference:** Uses a specialized 1D-CNN for rapid classification with a fallback to semantic analysis for complex queries.
- **Confidence Scoring:** Visual indicators (Green/Orange/Red) showing the AI's certainty level.

### 📱 User Experience

- **Voice-to-Text Interface:** Hands-free operation for high-stress emergency situations.
- **Local History:** Secure, on-device storage of past assessments (GDPR/HIPAA compliant design).
- **Tactile Feedback:** Haptic responses and pulse animations during voice recording.

### 🚑 Safety Protocols

- **Emergency Integration:** One-tap direct connection to emergency services (999/911) for critical triage results.
- **Validated Content:** First-aid steps derived from standard medical protocols.

---

## 🧠 Machine Learning Architecture

Sentinel is powered by a custom **Text Classification Model** trained specifically for medical intent recognition.

### The Model Pipeline (`ml_pipeline/notebooks/text_classification.ipynb`)

1.  **Preprocessing**:
    - Custom stop-word removal (filtering conversational filler like "please", "i think").
    - Tokenization with a vocabulary size of 1000 words.
    - Sequence padding to a fixed length of 15 tokens.

2.  **Network Architecture**:
    The model utilizes a **1D-Convolutional Neural Network (CNN)** structure, chosen for its ability to detect local patterns (n-grams) in short text sequences.

    ```mermaid
    graph TD
    A[Input Sequence (15 tokens)] --> B[Embedding Layer (32-dim)];
    B --> C[Conv1D (64 filters, kernel=3)];
    C --> D[GlobalMaxPooling1D];
    D --> E[Dense Layer (32 units, ReLU)];
    E --> F[Dropout (0.4)];
    F --> G[Output Layer (Softmax)];
    ```

    - **Conv1D**: Detects specific symptom phrases (e.g., "chest pain", "bone sticking out").
    - **GlobalMaxPooling**: Captures the most significant feature in the sentence, ensuring that critical keywords trigger the correct classification regardless of their position.
    - **Dropout**: Prevents overfitting during training on the small, specialized dataset.

### Secondary Model: Semantic Vector Search (Transformer)

When the primary CNN is uncertain (confidence < 65%), Sentinel engages a quantized version of the **`all-MiniLM-L6-v2`** Sentence Transformer. Unlike the CNN, this model does not classify text directly but understands _meaning_.

1.  **Embedding Generation**: The user's input is tokenized (BERT WordPiece) and passed through the Transformer to generate a **384-dimensional dense vector representation**.
2.  **Vector Similarity**: This vector is compared against a local database of "Anchor Vectors" (pre-computed centroids for each medical intent) using **Cosine Similarity**.

    ```mermaid
    graph LR
    A[User Input] --> B[BERT Tokenizer];
    B --> C[MiniLM Transformer];
    C --> D[384-dim Vector];
    D --> E{Dot Product Comparison};
    E --> F[Anchor: Fracture];
    E --> G[Anchor: Burn];
    E --> H[Anchor: CPR];
    E --> I[Result: Highest Similarity];
    ```

- **Why this matters**: It allows the app to understand phrasing it has never seen before (e.g., "my tummy feels like it's on fire" matches "Abdominal Pain") by mapping them to the same semantic space.
- **Performance**: The model is quantized to **int8**, reducing size to ~20MB while maintaining **>81% accuracy** on the MTEB leaderboard benchmarks.

---

## 🛠️ Tech Stack

### Mobile Application

- **Framework**: React Native (via Expo SDK 50+)
- **Language**: TypeScript
- **State Management**: React Hooks & Context
- **UI Components**: React Native Paper
- **Animations**: React Native Reanimated 3

### Machine Learning

- **Training**: Python, TensorFlow, Keras
- **Inference**: TensorFlow Lite (on-device)
- **Data Processing**: Pandas, NumPy

---

## 📂 Project Structure

```text
sentinel/
├── android/                # Native Android project files
├── assets/                 # Static assets (fonts, images)
├── ml_pipeline/            # Python ML environment
│   ├── data/               # Raw training datasets (intents.json)
│   ├── notebooks/          # Jupyter notebooks (V4 Model Training)
│   └── preprocess.py       # Data cleaning logic
├── src/
│   ├── app/                # Expo Router file-based navigation
│   ├── assets/             # App-bundled assets
│   │   └── models/         # TFLite models & vocabularies
│   ├── components/         # Reusable UI components
│   ├── constants/          # App-wide constants (Colors, SeverityMap)
│   ├── data/               # Static data (emergency_data.json)
│   ├── hooks/              # Custom hooks (useVoiceToText)
│   ├── screens/            # Main screen logic (ChatScreen)
│   └── services/           # Core Business Logic
│       ├── CNNEngine.ts    # Primary 1D-CNN Inference
│       ├── CNNVocab.ts     # Vocabulary management for CNN
│       ├── HistoryService.ts # Local storage (AsyncStorage)
│       ├── HybridEngine.ts # Orchestrator for CNN + ST
│       ├── KnowledgeBase.ts # Medical protocols database
│       ├── STEngine.ts     # Secondary Transformer Inference
│       └── STVocab.ts      # Vocabulary for Transformer
├── app.json                # Expo configuration
└── package.json
```

---

## 🚀 Getting Started

### Option A: Download Latest Release (Recommended for Users)

You can download the latest Android APK from our **[GitHub Releases Page](../../releases)**.

1.  Download `sentinel-v1.0.apk`.
2.  Install on your Android device (you may need to allow installation from unknown sources).

### Option B: Build from Source (For Developers)

**⚠️ Important:** This project uses native modules (TensorFlow Lite) and **cannot** be run in the standard Expo Go app. You must build a **Development Client**.

1.  **Clone the repository**

    ```bash
    git clone https://github.com/yourusername/sentinel.git
    cd sentinel
    ```

2.  **Install dependencies**

    ```bash
    npm install
    ```

3.  **Build & Run Development Client**
    Connect your Android device via USB (ensure USB Debugging is on) or start an emulator.

    ```bash
    # This will build the native app and install it on your device
    npx expo run:android
    ```

    _(For iOS, use `npx expo run:ios` - requires macOS)_

4.  **Start the Bundler**
    Once the app is installed on your device, the Metro bundler should start automatically. If not:
    ```bash
    npx expo start --dev-client
    ```

---

## ⚠️ Medical Disclaimer

**Sentinel is a prototype for educational and demonstrative purposes only.**

It is **not** a replacement for professional medical advice, diagnosis, or treatment. The triage results are generated by an AI model and may be inaccurate. In the event of a medical emergency, always contact your local emergency services immediately.
