#!/usr/bin/env python3
"""
Simple ingestion script:
- Extracts text from a .docx file using python-docx
- Chunks text with overlap
- Calls OpenAI embeddings API to get vectors
- Upserts into a vector store (example: PGVector via Postgres or Pinecone)
This is a minimal example; production code must handle retries, rate limits, PII redaction, and richer metadata.
"""
import os
import argparse
from docx import Document
from typing import List
from openai import OpenAI  # requires openai>=1.0.0 style SDK
import psycopg2
import base64
import json
import math
import hashlib

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
CHUNK_SIZE = int(os.getenv("INGESTION_CHUNK_SIZE", 800))
OVERLAP = int(os.getenv("INGESTION_OVERLAP", 100))
DATABASE_URL = os.getenv("DATABASE_URL")

client = OpenAI(api_key=OPENAI_API_KEY)

def extract_text_from_docx(path: str) -> List[str]:
    doc = Document(path)
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    # join small paragraphs into sections by page heuristics - keep simple
    return paragraphs

def chunk_text(paragraphs: List[str], chunk_size=CHUNK_SIZE, overlap=OVERLAP) -> List[str]:
    text = "\n\n".join(paragraphs)
    tokens = text.split()  # naive tokenization; replace with tiktoken for accuracy
    chunks = []
    i = 0
    while i < len(tokens):
        chunk_tokens = tokens[i:i+chunk_size]
        chunks.append(" ".join(chunk_tokens))
        i += chunk_size - overlap
    return chunks

def embed_texts(texts: List[str]):
    # OpenAI client example; adapt to SDK you use.
    resp = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [e.embedding for e in resp.data]

def upsert_pgvector(chunks: List[str], embeddings: List[List[float]], source_meta: dict):
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    # ensure table exists (simple)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS documents_chunks (
        id TEXT PRIMARY KEY,
        doc_title TEXT,
        chunk_text TEXT,
        metadata JSONB,
        embedding vector
    );
    """)
    for chunk, emb in zip(chunks, embeddings):
        chunk_id = hashlib.sha1(chunk.encode()).hexdigest()
        cur.execute("""
            INSERT INTO documents_chunks (id, doc_title, chunk_text, metadata, embedding)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE
            SET chunk_text = EXCLUDED.chunk_text,
                metadata = EXCLUDED.metadata,
                embedding = EXCLUDED.embedding;
        """, (chunk_id, source_meta.get("title"), chunk, json.dumps(source_meta), emb))
    conn.commit()
    cur.close()
    conn.close()

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--file", required=True, help="Path to .docx file")
    p.add_argument("--title", default="URA Excellence Blueprint", help="Document title")
    args = p.parse_args()

    paragraphs = extract_text_from_docx(args.file)
    chunks = chunk_text(paragraphs)
    print(f"Created {len(chunks)} chunks.")
    embeddings = embed_texts(chunks)
    print("Obtained embeddings.")
    meta = {"title": args.title, "source_file": os.path.basename(args.file)}
    upsert_pgvector(chunks, embeddings, meta)
    print("Upserted into vector store.")

if __name__ == "__main__":
    main()
