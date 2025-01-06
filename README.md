# PDF LLM Chat Assistant

An intelligent PDF analysis tool that enables interactive document conversations, visual analysis, and comprehensive learning features using advanced language models.

## 🌟 Key Features

### 📚 Interactive PDF Chat
- Context-aware conversations with your documents
- Smart text selection and analysis
- Citation tracking and reference management
- Real-time responses with source highlighting
- Choose between local or cloud vector storage per document

### 🔍 Hybrid Semantic Search
- Dual-technique search approach:
  - TF-IDF for keyword matching and exact phrases
  - Vector embeddings for semantic similarity
- Smart results ranking:
  - Weighted scoring system
  - Exact match boosting
  - Semantic relevance scoring
- Real-time search optimization:
  - Automatic query expansion
  - Context-aware filtering
  - Dynamic threshold adjustment

### 🎯 Search Implementation
```javascript
// Example of our hybrid search approach
const searchResults = await hybridSearch(query, {
  // TF-IDF Configuration
  tfidf: {
    minScore: 0.3,
    exactMatchBoost: 2.0,
    keywordWeight: 0.4
  },
  // Semantic Search Configuration
  semantic: {
    similarityThreshold: 0.7,
    semanticWeight: 0.6,
    maxResults: 5
  }
});
```

### 🎯 Search Process Flow:
1. **Query Processing**
   ```javascript
   // Split into keywords and create embeddings
   const keywords = extractKeywords(query);
   const embedding = await createEmbedding(query);
   ```

2. **Parallel Search**
   ```javascript
   // Run both search types concurrently
   const [keywordResults, semanticResults] = await Promise.all([
     tfidfSearch(keywords),
     vectorSearch(embedding)
   ]);
   ```

3. **Result Combination**
   ```javascript
   // Combine and re-rank results
   const combined = combineResults(keywordResults, semanticResults, {
     exactMatchBoost: 2.0,
     semanticWeight: 0.6,
     keywordWeight: 0.4
   });
   ```

### 🔍 Advanced Analysis Tools
- Text selection with multi-function menu
- Real-time translation of selected text
- Visual analysis of diagrams and figures using LLaMA Vision
- Page-by-page summarization
- Custom annotations and bookmarks

### 📝 Learning Enhancement
- Auto-generated comprehension questions
- End-of-page quizzes for understanding
- Interactive flashcard creation
- Progress tracking(to be done)
- Custom note-taking with AI assistance(to be done)

### 💾 Flexible Storage Options
- Per-document storage choice:
  - Local: IndexedDB for offline and private use
  - Cloud: Pinecone for cross-device sync
- Automatic synchronization
- Secure data handling
- Easy export and backup

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Together AI API key
- Pinecone API key (optional - for cloud storage)

