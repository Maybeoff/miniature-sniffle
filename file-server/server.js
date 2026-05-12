import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { randomUUID } from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

// Создаем папку uploads если её нет
const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

app.use(cors())
app.use('/uploads', express.static(uploadsDir))

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${randomUUID()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/',
      'video/',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/',
      'application/zip',
      'application/x-zip-compressed',
    ]
    
    const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type) || file.mimetype === type)
    
    if (!isAllowed) {
      return cb(new Error('Неподдерживаемый тип файла'))
    }
    cb(null, true)
  },
})

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' })
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
  res.json({ url })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`File server running on http://localhost:${PORT}`))
