def get_sample_corpus_bytes() -> bytes:
    return """
# Retrieval-Augmented Generation (RAG)

## Overview
Retrieval-Augmented Generation (RAG) is a technique that combines the power of large language models (LLMs) with external knowledge retrieval. Instead of relying solely on the model's training data, RAG systems fetch relevant documents from a knowledge base and use them as context for generating answers.

## How RAG Works
The RAG pipeline consists of several key stages:

1. **Document Ingestion**: Documents are split into chunks, each chunk is converted into a vector embedding, and stored in a vector database.

2. **Query Processing**: When a user asks a question, the query is also converted into a vector embedding.

3. **Retrieval**: The query embedding is compared against all document embeddings using similarity search (cosine similarity, dot product, etc.). The top-K most similar chunks are retrieved.

4. **Augmentation**: The retrieved chunks are combined with the original query to form an augmented prompt.

5. **Generation**: The augmented prompt is sent to an LLM, which generates an answer grounded in the retrieved context.

## Key Metrics
- **Groundedness**: How well the answer is supported by the retrieved documents.
- **Relevance**: How relevant the answer is to the user's question.
- **Citation Coverage**: What percentage of claims in the answer are backed by citations.
- **Retrieval Precision**: How many of the retrieved documents were actually useful.

## Retrieval Strategies
Different retrieval strategies offer different tradeoffs:

### Basic Vector Search (Baseline)
Simple cosine similarity search. Fast but can miss semantically related content that uses different vocabulary.

### Hybrid Search (Plus Tier)
Combines vector similarity with keyword (BM25/TF-IDF) search. Catches both semantic and lexical matches. Typically improves recall by 15-30%.

### Re-ranking (Enterprise Tier)
Uses a cross-encoder model to re-rank the initial retrieval results. More computationally expensive but significantly improves precision. Can improve accuracy by 20-40% on complex queries.

### Document-Native Retrieval (Modern Tier)
Techniques like page-aware indexing, metadata enrichment, and adaptive retrieval use document structure directly instead of flattening everything into generic chunks.

## Cost Considerations
RAG systems have several cost components:
- **Embedding computation**: Typically $0.0001-0.001 per 1000 tokens
- **Vector database storage**: Depends on scale, typically $0.01-0.10 per GB/month
- **LLM inference**: The largest cost component, varying widely by model
- **Reranking**: Cross-encoder reranking adds $0.001-0.01 per query

## Quality-Cost Tradeoff
The fundamental insight of modern RAG systems is the tradeoff between quality and cost:
- **Starter**: Cheap and credible, but weaker on messy structure and cross-document balance.
- **Plus**: Moderate cost, biggest answer-quality jump for most real teams.
- **Enterprise**: Higher cost, stronger predictability, grounding, and operational trust.
- **Modern**: Enterprise-grade core plus newer document-native methods that are already serious, but not yet universal.

## Common Failure Modes
1. **Hallucination**: The LLM generates plausible-sounding but incorrect information not supported by the context.
2. **Context Window Overflow**: Too many retrieved chunks overwhelm the model's context window.
3. **Retrieval Miss**: The relevant document exists but wasn't retrieved due to poor embedding quality.
4. **Stale Data**: The knowledge base contains outdated information.
5. **Prompt Injection**: Malicious content in documents that attempts to override model instructions.

## Production Considerations
For production RAG deployments:
- Implement proper monitoring (latency, retrieval quality, user satisfaction)
- Use caching for repeated queries
- Implement rate limiting to control costs
- Version your knowledge base
- Set up automated evaluation pipelines
- Consider multi-tenant isolation if serving multiple customers
""".strip().encode("utf-8")
