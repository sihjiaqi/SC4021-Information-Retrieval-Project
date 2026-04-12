import pandas as pd
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from sklearn.metrics import classification_report
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay
import matplotlib.pyplot as plt

df = pd.read_csv(r"C:\Users\esther\Desktop\y2sem2\4021 information retrieval\proj\corpus_evaluation.csv")

df["label_subjectivity"] = df["label_subjectivity"].str.strip().str.capitalize()
df["label_sentiment"] = df["label_sentiment"].str.strip().str.capitalize()

analyzer = SentimentIntensityAnalyzer()

# subjectivity
def vader_subjectivity(text):
    scores = analyzer.polarity_scores(str(text))
    compound = scores["compound"]
    if abs(compound) < 0.05:
        return "Objective"
    else:
        return "Subjective"

# polarity
def vader_polarity(text):
    scores = analyzer.polarity_scores(str(text))
    compound = scores["compound"]
    if compound >= 0.05:
        return "Positive"
    elif compound <= -0.05:
        return "Negative"
    else:
        return "Neutral"

# run
df["vader_subjectivity"] = df["text_ml"].apply(vader_subjectivity)
df["vader_polarity"] = df["text_ml"].apply(vader_polarity)

# print results
print("Polarity Classification Report:")
print(classification_report(df["label_sentiment"], df["vader_polarity"]))

print("Subjective Classification Report:")
print(classification_report(df["label_subjectivity"], df["vader_subjectivity"]))

## PRINT CONFUSION MATRIX:
# polarity
polarity_labels = ["Negative", "Neutral", "Positive"]
cm_polarity = confusion_matrix(df["label_sentiment"], df["vader_polarity"], labels=polarity_labels)
disp_polarity = ConfusionMatrixDisplay(confusion_matrix=cm_polarity, display_labels=polarity_labels)
disp_polarity.plot(cmap="Blues")
plt.title("VADER Polarity Confusion Matrix")
plt.tight_layout()
plt.show()

# subjectivity
subjectivity_labels = ["Objective", "Subjective"]
cm_subjectivity = confusion_matrix(df["label_subjectivity"], df["vader_subjectivity"], labels=subjectivity_labels)
disp_subjectivity = ConfusionMatrixDisplay(confusion_matrix=cm_subjectivity, display_labels=subjectivity_labels)
disp_subjectivity.plot(cmap="Blues")
plt.title("VADER Subjectivity Confusion Matrix")
plt.tight_layout()
plt.show()