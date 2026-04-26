// Copies face-api.min.js to vendor/ and downloads model weights to models/
const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const VENDOR_DIR = path.join(ROOT, 'vendor')
const MODELS_DIR = path.join(ROOT, 'models')

const FACE_API_SRC = path.join(ROOT, 'node_modules', 'face-api.js', 'dist', 'face-api.min.js')
const FACE_API_DST = path.join(VENDOR_DIR, 'face-api.min.js')

const MODEL_BASE = 'https://github.com/justadudewhohacks/face-api.js/raw/master/weights/'
const MODEL_FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1'
]

function ensureDir (dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// Follows redirects, writes to dest
function download (url, dest, redirectsLeft = 10) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) { resolve(); return }
    if (redirectsLeft === 0) { reject(new Error('too many redirects')); return }

    const mod = url.startsWith('https') ? https : http
    mod.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        res.resume()  // drain response
        download(res.headers.location, dest, redirectsLeft - 1).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode} — ${url}`))
        return
      }
      const file = fs.createWriteStream(dest)
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
      file.on('error', (err) => {
        try { fs.unlinkSync(dest) } catch (_) {}
        reject(err)
      })
    }).on('error', (err) => {
      try { fs.unlinkSync(dest) } catch (_) {}
      reject(err)
    })
  })
}

async function main () {
  ensureDir(VENDOR_DIR)
  ensureDir(MODELS_DIR)

  if (fs.existsSync(FACE_API_SRC)) {
    fs.copyFileSync(FACE_API_SRC, FACE_API_DST)
    console.log('[setup] copied face-api.min.js → vendor/')
  } else {
    console.warn('[setup] face-api.min.js not found — run npm install first')
  }

  for (const file of MODEL_FILES) {
    const dest = path.join(MODELS_DIR, file)
    try {
      await download(MODEL_BASE + file, dest)
      console.log('[setup] model:', file)
    } catch (err) {
      console.warn('[setup] failed to download', file, '—', err.message)
    }
  }
}

main().catch(console.error)
