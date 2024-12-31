/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    PINECONE_API_KEY: process.env.PINECONE_API_KEY,
    TOGETHER_API_KEY: process.env.TOGETHER_API_KEY,
  }
}

export default nextConfig
