import pandas as pd
from sklearn.metrics import cohen_kappa_score

df = pd.read_csv(r"C:\Users\esther\Desktop\y2sem2\4021 information retrieval\proj\fullcorpus.csv")

df_clean = df.dropna(subset=["annotator_1", "annotator_2", "annotator_3"])

print(f"Total records in file: {len(df)}")
print(f"Records labeled by all three: {len(df_clean)}")

df_clean["annotator_1"] = df_clean["annotator_1"].str.strip().str.lower()
df_clean["annotator_2"] = df_clean["annotator_2"].str.strip().str.lower()
df_clean["annotator_3"] = df_clean["annotator_3"].str.strip().str.lower()

# calc cohen kappa score
kappa_12 = cohen_kappa_score(df_clean["annotator_1"], df_clean["annotator_2"])
kappa_13 = cohen_kappa_score(df_clean["annotator_1"], df_clean["annotator_3"])
kappa_23 = cohen_kappa_score(df_clean["annotator_2"], df_clean["annotator_3"])

agreement_12 = (df_clean["annotator_1"] == df_clean["annotator_2"]).mean() * 100
agreement_13 = (df_clean["annotator_1"] == df_clean["annotator_3"]).mean() * 100
agreement_23 = (df_clean["annotator_2"] == df_clean["annotator_3"]).mean() * 100

print(f"\nAnnotator 1 vs 2 — Agreement: {agreement_12:.1f}%, Cohen's Kappa: {kappa_12:.2f}")
print(f"Annotator 1 vs 3 — Agreement: {agreement_13:.1f}%, Cohen's Kappa: {kappa_13:.2f}")
print(f"Annotator 2 vs 3 — Agreement: {agreement_23:.1f}%, Cohen's Kappa: {kappa_23:.2f}")

# overall 
avg_agreement = (agreement_12 + agreement_13 + agreement_23) / 3
avg_kappa = (kappa_12 + kappa_13 + kappa_23) / 3
print(f"\nAverage Agreement: {avg_agreement:.1f}%")
print(f"Average Kappa: {avg_kappa:.2f}")
