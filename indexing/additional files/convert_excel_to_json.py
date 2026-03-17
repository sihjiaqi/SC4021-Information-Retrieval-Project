# Run these commands before running this script
# python -m venv env
# source env/bin/activate or .\env\Scripts\activate
# pip install pandas openpyxl

import pandas as pd
import json

df = pd.read_excel("corpus_full.xlsx")

# rename field for solr unique key
df = df.rename(columns={"doc_id":"id"})

records = df.to_dict(orient="records")

with open("solr_docs.json","w") as f:
    json.dump(records,f)