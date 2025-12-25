import re
import string

# The "Source of Truth" for your stop words.
# Ensure this matches the logic your teammates use in the React Native app.
STOP_WORDS = [
    "help", "i", "think", "got", "my", "me", "the", "a", "an", 
    "please", "somebody", "do", "does", "is", "am", "are"
]

def clean_text(text):
    """
    Standardizes input text by lowering case, removing punctuation, 
    and filtering out conversational stop words.
    """
    if not text:
        return ""

    # 1. Lowercase
    text = text.lower()

    # 2. Remove punctuation using regex
    # This replaces everything in string.punctuation with an empty string
    text = re.sub(f"[{re.escape(string.punctuation)}]", "", text)

    # 3. Tokenize and filter stop words
    words = text.split()
    filtered_words = [w for w in words if w not in STOP_WORDS]

    # 4. Re-join and strip extra whitespace
    return " ".join(filtered_words).strip()

if __name__ == "__main__":
    # Test cases to verify the script works as expected
    sample_inputs = [
        "Help! I think i got my ribs fractured.",
        "Please help, somebody is choking!",
        "I have a minor cut on my finger."
    ]
    
    print("Testing Preprocessing Logic:")
    print("-" * 30)
    for sample in sample_inputs:
        print(f"Original: {sample}")
        print(f"Cleaned : {clean_text(sample)}\n")
