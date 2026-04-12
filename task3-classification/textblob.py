import pandas as pd
from textblob import TextBlob
from sklearn.metrics import classification_report
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay
import matplotlib.pyplot as plt

df = pd.read_csv(r"C:\Users\esther\Desktop\y2sem2\4021 information retrieval\proj\corpus_evaluation.csv")

df["label_subjectivity"] = df["label_subjectivity"].str.strip().str.capitalize()
df["label_sentiment"] = df["label_sentiment"].str.strip().str.capitalize()

# subjectivity
def textblob_subjectivity(text):
    analysis = TextBlob(str(text))
    if analysis.sentiment.subjectivity < 0.4:
        return "Objective"
    else:
        return "Subjective"

# polarity
def textblob_polarity(text):
    analysis = TextBlob(str(text))
    polarity = analysis.sentiment.polarity
    if polarity > 0.05:
        return "Positive"
    elif polarity < -0.05:
        return "Negative"
    else:
        return "Neutral"

# run
df["textblob_subjectivity"] = df["text_ml"].apply(textblob_subjectivity)
df["textblob_polarity"] = df["text_ml"].apply(textblob_polarity)

# print results
print("Polarity Classification Report:")
print(classification_report(df["label_sentiment"], df["textblob_polarity"]))

print("Subjective Classification Report:")
print(classification_report(df["label_subjectivity"], df["textblob_subjectivity"]))

## PRINT CONFUSION MATRIX
# polarity
polarity_labels = ["Negative", "Neutral", "Positive"]
cm_polarity = confusion_matrix(df["label_sentiment"], df["textblob_polarity"], labels=polarity_labels)
disp_polarity = ConfusionMatrixDisplay(confusion_matrix=cm_polarity, display_labels=polarity_labels)
disp_polarity.plot(cmap="Blues")
plt.title("TextBlob Polarity Confusion Matrix")
plt.tight_layout()
plt.show()

# subjectivity
subjectivity_labels = ["Objective", "Subjective"]
cm_subjectivity = confusion_matrix(df["label_subjectivity"], df["textblob_subjectivity"], labels=subjectivity_labels)
disp_subjectivity = ConfusionMatrixDisplay(confusion_matrix=cm_subjectivity, display_labels=subjectivity_labels)
disp_subjectivity.plot(cmap="Blues")
plt.title("TextBlob Subjectivity Confusion Matrix")
plt.tight_layout()
plt.show()