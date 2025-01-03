import { localVectorStore } from '../localVectorStore'

async function testBM25Search() {
  // Test documents
  const testDocs = [
    {
      id: 'doc1',
      text: "Sam Walton founded Walmart in 1962. He was a retail pioneer.",
      pageNumber: 1,
      pdfName: "test1.pdf"
    },
    {
      id: 'doc2',
      text: "Sam Walton Sam Walton Sam Walton retail retail retail",  // Repeated terms
      pageNumber: 1,
      pdfName: "test2.pdf"
    },
    {
      id: 'doc3',
      text: "The retail industry has many players. Some are big, some are small.",  // Related but no exact match
      pageNumber: 1,
      pdfName: "test3.pdf"
    }
  ]

  // Store test documents
  for (const doc of testDocs) {
    await localVectorStore.storeVector(doc.id, [], {
      text: doc.text,
      pageNumber: doc.pageNumber,
      pdfName: doc.pdfName
    })
  }

  // Test queries
  const queries = [
    "Sam Walton",
    "retail",
    "Som Wolton",  // Misspelled
    "Sam Walton retail"
  ]

  console.log("Starting BM25 Search Tests...")
  
  for (const query of queries) {
    console.log(`\nTesting query: "${query}"`)
    const results = await localVectorStore.searchByKeyword(query)
    
    console.log("Results:")
    results.forEach((r, i) => {
      console.log(`${i + 1}. Score: ${r.score.toFixed(3)} (Exact: ${r.exactMatchScore.toFixed(3)})`)
      console.log(`   Text: ${r.text}`)
    })
  }
} 

async function testNameSearch() {
  const testDocs = [
    {
      id: 'doc1',
      text: "Marc Ridore is a GPRS engineer.",
      pageNumber: 1,
      pdfName: "test1.pdf"
    },
    {
      id: 'doc2',
      text: "Mark Johnson works in retail.",
      pageNumber: 1,
      pdfName: "test2.pdf"
    },
    {
      id: 'doc3',
      text: "Sam Walton founded Walmart.",
      pageNumber: 1,
      pdfName: "test3.pdf"
    }
  ]

  // Clear previous test data
  await localVectorStore.clearDatabase()

  // Store test documents
  for (const doc of testDocs) {
    await localVectorStore.storeVector(doc.id, [], {
      text: doc.text,
      pageNumber: doc.pageNumber,
      pdfName: doc.pdfName
    })
  }

  // Test specific name queries
  const queries = [
    "marc",
    "mark",
    "marc ridore",
    "mark johnson",
    "morc ridore" // Misspelled
  ]

  console.log("\nTesting Name Search Precision...")
  
  for (const query of queries) {
    console.log(`\nQuery: "${query}"`)
    const results = await localVectorStore.searchByKeyword(query)
    
    console.log("Results:")
    results.forEach((r, i) => {
      console.log(`${i + 1}. Score: ${r.score.toFixed(3)} (Exact: ${r.exactMatchScore.toFixed(3)})`)
      console.log(`   Text: ${r.text}`)
    })
  }
}

// Run both tests
async function runTests() {
  await testBM25Search()
  await testNameSearch()
}

export { runTests } 