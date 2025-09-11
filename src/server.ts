import 'dotenv/config'
import app from './app'

// For Vercel serverless deployment
export default app

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`✅ Express server running on port ${PORT}`)
})


