const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const calculateMD5 = (data) => {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')
}

const getCache = (cachePath, data, callback = undefined) => {
  if (cachePath) {
    const id = calculateMD5(JSON.stringify(data))
    const filePath = path.join(cachePath, `${id}.json`)

    if (fs.existsSync(filePath)) {
      const fileContents = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(fileContents)
    }
  }

  if (callback) {
    const response = callback()
    saveCache(cachePath, data, response)
    return response
  }

  return false
}

const saveCache = (cachePath, data, response) => {
  if (!cachePath) return

  const id = calculateMD5(JSON.stringify(data))
  const filePath = path.join(cachePath, `${id}.json`)

  fs.writeFileSync(filePath, JSON.stringify(response))
}

module.exports = { getCache, saveCache }