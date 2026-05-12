import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import authRoutes from './routes/auth.js'
import postsRoutes from './routes/posts.js'
import usersRoutes from './routes/users.js'
import uploadRoutes from './routes/upload.js'
import messagesRoutes from './routes/messages.js'
import { setupWebSocket } from './websocket.js'

const app = express()
const server = createServer(app)

app.use(cors())
app.use(express.json({ limit: '50mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/messages', messagesRoutes)

setupWebSocket(server)

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
