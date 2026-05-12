import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// Настройка multer для загрузки в память
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
})

// Роут для загрузки файлов через multipart/form-data
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' })
    }

    const formData = new FormData()
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype })
    formData.append('file', blob, req.file.originalname)

    const response = await fetch(`${process.env.FILE_SERVER_URL}/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('File server error:', error)
      throw new Error('File server error')
    }

    const data = await response.json()
    res.json(data)
  } catch (e) {
    console.error('Upload error:', e)
    res.status(500).json({ error: 'Ошибка загрузки' })
  }
})

// Роут для загрузки изображений через base64 (для обратной совместимости)
router.post('/image', async (req, res) => {
  try {
    const { base64, filename, contentType } = req.body
    if (!base64) return res.status(400).json({ error: 'Файл не загружен' })
    
    const buffer = Buffer.from(base64.split(',')[1], 'base64')
    const formData = new FormData()
    const blob = new Blob([buffer], { type: contentType })
    formData.append('file', blob, filename)
    
    const response = await fetch(`${process.env.FILE_SERVER_URL}/upload`, {
      method: 'POST',
      body: formData,
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error('File server error:', error)
      throw new Error('File server error')
    }
    
    const data = await response.json()
    res.json(data)
  } catch (e) {
    console.error('Upload error:', e)
    res.status(500).json({ error: 'Ошибка загрузки' })
  }
})

export default router
