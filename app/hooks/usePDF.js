import { useCallback } from 'react'
import { pdfjs } from 'react-pdf'
import { clientLocalStore } from '../lib/clientLocalStore'

export function usePDF() {
  const processPage = useCallback(async (page, documentId, pdfName) => {
    try {
      const textContent = await page.getTextContent()
      const text = textContent.items
        .map(item => item.str)
        .join(' ')
        .trim()

      if (!text) {
        console.log('Empty page content, skipping...')
        return null
      }

      // Store page in local vector store
      return clientLocalStore.storePage({
        text,
        pageNumber: page.pageNumber,
        documentId,
        pdfName,
        skipExistCheck: true
      })
    } catch (error) {
      console.error('Error processing page:', error)
      throw error
    }
  }, [])

  const processPDF = useCallback(async (file) => {
    try {
      const data = await file.arrayBuffer()
      const pdf = await pdfjs.getDocument(data).promise
      const documentId = `doc-${Date.now()}`
      
      // First check if document exists
      const exists = await clientLocalStore.checkDocumentExists(file.name)
      if (exists) {
        console.log('Document already exists:', file.name)
        return null
      }

      console.log('Processing PDF:', {
        numPages: pdf.numPages,
        documentId,
        fileName: file.name
      })

      // Process all pages in parallel
      const pagePromises = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        pagePromises.push(processPage(page, documentId, file.name))
      }

      await Promise.all(pagePromises)
      
      return {
        documentId,
        numPages: pdf.numPages
      }
    } catch (error) {
      console.error('Error processing PDF:', error)
      throw error
    }
  }, [processPage])

  return { processPDF }
} 