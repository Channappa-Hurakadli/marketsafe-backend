import pandas as pd
import numpy as np
import math
import hashlib
import sys
import os

# --- Helper Functions from your Notebook ---

def generalize_integer_column_auto(series):
    if not pd.api.types.is_integer_dtype(series):
        return series # Return as is if not integer
    n = len(series)
    if n == 0: return series
    data_min, data_max = series.min(), series.max()
    data_range = data_max - data_min
    if data_range == 0: return pd.Series([f"{data_min}-{data_min}"] * n, index=series.index)
    num_bins = math.ceil(1 + math.log2(n))
    bucket_size = math.ceil(data_range / num_bins)
    def to_bucket(val):
        start = ((val - data_min) // bucket_size) * bucket_size + data_min
        end = start + bucket_size - 1
        return f"{start}-{end}"
    return series.apply(to_bucket)

def pseudonymize_customer_ids(series):
    unique_ids = series.unique()
    pseudonym_map = {real_id: f"CUST{idx:04d}" for idx, real_id in enumerate(unique_ids, start=1)}
    return series.map(pseudonym_map)

def mask_sensitive_column(series):
    return pd.Series(["[REDACTED]"] * len(series), index=series.index)

# --- Main Anonymization Logic ---

def anonymize_dataset(input_path, output_path):
    try:
        df = pd.read_csv(input_path)

        # --- Preprocessing from your notebook ---
        df = df.drop_duplicates()
        for col in df.select_dtypes(include=['object']).columns:
            df[col] = df[col].str.strip()
        for col in df.columns:
            if df[col].dtype in [np.float64, np.int64]:
                df[col] = df[col].fillna(df[col].median())
            else:
                df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else '')

        # --- Attribute Classification and Anonymization ---
        sensitive_keywords = ['salary', 'income', 'platform', 'tool']
        quasi_identifier_keywords = ['age', 'gender', 'zipcode', 'city']

        for col in df.columns:
            col_lower = col.lower()
            
            # Requirement 1: Apply anonymization based on column type/name
            if 'customerid' in col_lower:
                df[col] = pseudonymize_customer_ids(df[col])
            elif any(keyword in col_lower for keyword in sensitive_keywords):
                df[col] = mask_sensitive_column(df[col])
            elif any(keyword in col_lower for keyword in quasi_identifier_keywords) and pd.api.types.is_integer_dtype(df[col]):
                 df[col] = generalize_integer_column_auto(df[col])

        # Requirement 2: Save the anonymized dataset to the specified output path
        df.to_csv(output_path, index=False)
        print(f"Anonymization complete. Output saved to {output_path}")

    except Exception as e:
        print(f"Error during anonymization: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python anonymize.py <input_filepath> <output_filepath>", file=sys.stderr)
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    anonymize_dataset(input_file, output_file)
