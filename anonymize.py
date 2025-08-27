import pandas as pd
import numpy as np
import math
import hashlib
import sys
import os

# --- Preprocessing and Helper Functions ---

def preprocess_dataset(df):
    # Remove duplicates
    df = df.drop_duplicates()
    # Strip whitespace from string columns
    for col in df.select_dtypes(include=['object']).columns:
        df[col] = df[col].str.strip()
    # Handle missing values
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].fillna(df[col].median())
        else:
            df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else '')
    return df

def generalize_integer_column_auto(series):
    if not pd.api.types.is_integer_dtype(series):
        # Return non-integer series as is, without raising an error
        return series
    
    n = len(series.dropna())
    if n == 0: return series
    
    data_min, data_max = series.min(), series.max()
    data_range = data_max - data_min
    
    if data_range == 0:
        return pd.Series([f"{data_min}-{data_min}"] * len(series), index=series.index)
    
    num_bins = math.ceil(1 + math.log2(n)) if n > 1 else 1
    bucket_size = math.ceil(data_range / num_bins) if num_bins > 0 else 1
    if bucket_size == 0: bucket_size = 1 # Avoid division by zero

    def to_bucket(val):
        if pd.isna(val): return None
        start = int(((val - data_min) // bucket_size) * bucket_size + data_min)
        end = int(start + bucket_size - 1)
        return f"{start}-{end}"
        
    return series.apply(to_bucket)

def generalize_integer_column_fixed_bin(series, bin_size=5):
    if not pd.api.types.is_integer_dtype(series):
        return series
    n = len(series.dropna())
    if n == 0: return series
    data_min = series.min()
    def to_bucket(val):
        if pd.isna(val): return None
        start = int(((val - data_min) // bin_size) * bin_size + data_min)
        end = int(start + bin_size - 1)
        return f"{start}-{end}"
    return series.apply(to_bucket)

def guess_column_type(series):
    if pd.api.types.is_integer_dtype(series): return 'integer'
    if pd.api.types.is_float_dtype(series): return 'float'
    return 'categorical'

def classify_attribute(series):
    col_name = series.name.lower()
    if 'id' in col_name: return 'Quasi-Identifier'
    sensitive_keywords = ['ssn', 'socialsecurity', 'creditcard', 'password', 'phone', 'health', 'medical', 'salary', 'income', 'platform', 'tool']
    quasi_identifier_keywords = ['age', 'dob', 'zipcode', 'city', 'state', 'gender', 'race']
    if any(keyword in col_name for keyword in sensitive_keywords): return 'Sensitive'
    if any(keyword in col_name for keyword in quasi_identifier_keywords): return 'Quasi-Identifier'
    return 'Normal'

def mask_sensitive_column(series):
    return pd.Series(["[REDACTED]"] * len(series), index=series.index)

def pseudonymize_customer_ids(series):
    unique_ids = series.dropna().unique()
    pseudonym_map = {real_id: f"CUST{idx:04d}" for idx, real_id in enumerate(unique_ids, start=1)}
    return series.map(pseudonym_map)

def encode_gender_column(series):
    return series.astype(str).str.strip().str.lower().map({'male': 1, 'female': 0})

def reversible_perturb(series, noise_level=0.05):
    std_dev = series.std()
    if std_dev == 0: return series
    noise = np.random.normal(0, noise_level * std_dev, len(series))
    return series + noise

# --- Main Anonymization Logic ---

def anonymize_dataset(input_path, output_path):
    try:
        df = pd.read_csv(input_path)
        df = preprocess_dataset(df)

        types = {col: guess_column_type(df[col]) for col in df.columns}
        classification = {col: classify_attribute(df[col]) for col in df.columns}

        for col in df.columns:
            col_class = classification[col]
            col_type = types[col]

            if col_class == 'Quasi-Identifier' and col_type == 'integer':
                if "id" in col.lower():
                    df[col] = pseudonymize_customer_ids(df[col])
                else:
                    df[col] = generalize_integer_column_auto(df[col])
            elif col_class == 'Sensitive' and col_type == 'categorical':
                df[col] = mask_sensitive_column(df[col])
            elif col.lower() == 'gender':
                df[col] = encode_gender_column(df[col])
            elif col_type == 'float':
                df[col] = reversible_perturb(df[col])
            elif col.lower() == 'previouspurchases':
                df[col] = generalize_integer_column_fixed_bin(df[col])
        
        # L-Diversity Enforcement (Example on 'EmailOpens')
        # In a real scenario, you would let the user choose the sensitive attribute
        quasi_identifiers = ['Age', 'Income']
        sensitive_col = 'EmailOpens'
        
        if all(c in df.columns for c in quasi_identifiers) and sensitive_col in df.columns:
            # First, generalize the quasi-identifiers if they haven't been already
            if not isinstance(df['Age'].iloc[0], str):
                 df['Age'] = generalize_integer_column_auto(df['Age'])
            if not isinstance(df['Income'].iloc[0], str):
                 df['Income'] = generalize_integer_column_auto(df['Income'])

            grouped = df.groupby(quasi_identifiers)
            for _, group_indices in grouped.groups.items():
                group = df.loc[group_indices]
                if group[sensitive_col].nunique() < 2: # l=2
                    # This is a simplified suppression method for groups that violate l-diversity
                    df.loc[group_indices, sensitive_col] = np.nan 

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
