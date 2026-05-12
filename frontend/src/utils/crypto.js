// Утилиты для E2E шифрования сообщений

// Генерация пары ключей RSA
export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  )
  return keyPair
}

// Экспорт публичного ключа в строку
export async function exportPublicKey(publicKey) {
  const exported = await window.crypto.subtle.exportKey('spki', publicKey)
  const exportedAsString = arrayBufferToBase64(exported)
  return exportedAsString
}

// Импорт публичного ключа из строки
export async function importPublicKey(publicKeyString) {
  const publicKeyBuffer = base64ToArrayBuffer(publicKeyString)
  const publicKey = await window.crypto.subtle.importKey(
    'spki',
    publicKeyBuffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  )
  return publicKey
}

// Экспорт приватного ключа в строку
export async function exportPrivateKey(privateKey) {
  const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey)
  const exportedAsString = arrayBufferToBase64(exported)
  return exportedAsString
}

// Импорт приватного ключа из строки
export async function importPrivateKey(privateKeyString) {
  const privateKeyBuffer = base64ToArrayBuffer(privateKeyString)
  const privateKey = await window.crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  )
  return privateKey
}

// Шифрование сообщения публичным ключом получателя
export async function encryptMessage(message, publicKey) {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    publicKey,
    data
  )
  
  return arrayBufferToBase64(encrypted)
}

// Расшифровка сообщения своим приватным ключом
export async function decryptMessage(encryptedMessage, privateKey) {
  const encryptedBuffer = base64ToArrayBuffer(encryptedMessage)
  
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP',
    },
    privateKey,
    encryptedBuffer
  )
  
  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

// Вспомогательные функции для конвертации
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

function base64ToArrayBuffer(base64) {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// Сохранение ключей в localStorage
export function saveKeys(publicKey, privateKey) {
  localStorage.setItem('publicKey', publicKey)
  localStorage.setItem('privateKey', privateKey)
}

// Загрузка ключей из localStorage
export function loadKeys() {
  return {
    publicKey: localStorage.getItem('publicKey'),
    privateKey: localStorage.getItem('privateKey'),
  }
}

// Проверка наличия ключей
export function hasKeys() {
  const keys = loadKeys()
  return !!(keys.publicKey && keys.privateKey)
}
