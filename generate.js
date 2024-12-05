const path = require('path')
const { execSync } = require('child_process')
const { OpenAI } = require('openai')
const { encoding_for_model } = require("tiktoken")
const { getCache, saveCache } = require('./helpers/cache')
const fs = require('fs')

const DEFAULT_MODEL = 'gpt-4o-mini-2024-07-18'
const DEFAULT_MAX_COMPLETION_TOKENS = 16384
const openai = new OpenAI()

function countTokens(prompt, model, cache_path) {
  return getCache(cache_path, prompt, () => {
    const encoding = encoding_for_model(model)
    const tokens = encoding.encode(prompt)
    const tokenCount = tokens.length
    encoding.free()
    return tokenCount  
  })
}

async function mergeReleaseNotes(release_notes, model, max_completion_tokens, language, cache_path) {
  const instructions = [
    "You will be given several release notes from different branches.",
    `Your goal is to combine them into a single release notes document and organize them in ${language}.`,
    "Remove any duplicate notes.",
  ].join("\n")

  const notes = release_notes.join("\n\n")

  try {
    const data = {
      model: model || DEFAULT_MODEL,
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: notes }
      ],
      max_completion_tokens: max_completion_tokens
    }

    let completion = getCache(cache_path, data)
    if (!completion) {
      completion = await openai.chat.completions.create(data)
      saveCache(cache_path, data, completion)
    }
    
    return completion.choices[0].message.content.trim()
  } catch (error) {
    console.error("Error al comunicarse con la API de OpenAI:", error)
    return null
  }
}

async function generateReleaseNotes(diffContent, model, max_completion_tokens, language, additional_context, cache_path) {
  const instructions = [
    `Provide a list of changes (release notes) in ${language} based on the information provided to you.`,
    "The given changes will include a list of 'commit messages' and 'diff' within a range of commits.",
    "As additional context, the Bax application has the following description in app stores:",
    '"""',
    additional_context,
    '"""',
  ].join("\n")
  
  try {
    const data = {
      model: model || DEFAULT_MODEL,
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: diffContent }
      ],
      max_completion_tokens: max_completion_tokens
    }

    let completion = getCache(cache_path, data)
    if (!completion) {
      completion = await openai.chat.completions.create(data)
      saveCache(cache_path, data, completion)
    }

    return completion.choices[0].message.content.trim()
  } catch (error) {
    console.error("Error al comunicarse con la API de OpenAI:", error)
    return null
  }
}

function getCommandResult(projectPath, command) {
  try {
    const cwd = process.cwd()
    process.chdir(projectPath)
    const result = execSync(command).toString()
    process.chdir(cwd)
    return result
  } catch (error) {
    console.error(`Error running command '${command}':`, error)
    process.exit(1)
  }
}

async function generate({ projectPath, gitRange, model, max_completion_tokens, language, additional_context, exclude_files, exclude_ext, output, cache_path }) {
  if (isNaN(Number(max_completion_tokens))) max_completion_tokens = DEFAULT_MAX_COMPLETION_TOKENS
  if (!model) model = DEFAULT_MODEL
  if (!language) language = "english"
  if (!additional_context) additional_context = ""

  const diff = getCommandResult(projectPath, `git diff ${gitRange}`)

  const ignoredFiles = exclude_files || ["yarn.lock", "package-lock.json", "Gemfile.lock", "Podfile.lock", "project.pbxproj"]
  const binaryExtensions = exclude_ext || ["svg", "png", "jpg", "jar"]

  const cleanedChanges = []

  if (output) console.log("Filtering files...")
  const parts = diff.split(/^diff --git/m)
  parts.forEach(part => {
    const change = part.trim()
    if (!change) return

    const lines = change.split("\n")
    const files = "diff --git" + lines[0]
    const action = lines[1]

    const filepath = files.split(" b/").slice(-1)[0]
    if (!filepath || filepath.startsWith("diff")) throw new Error("Inhandled diff case: " + files)

    const file = filepath.split("/").slice(-1)[0]
    const extension = file.split(".").slice(-1)[0]

    if (ignoredFiles.includes(file)) return

    const commitsDiff = getCommandResult(projectPath, `git log ${gitRange} --format="%H %s" -- ${filepath}`)
    const commits = commitsDiff.trim().split("\n").reduce((memo, line) => {
      const index = line.indexOf(" ")
      const commit = line.slice(0, index)
      const message = line.slice(index + 1)
      memo[commit] = message
      return memo
    }, {})

    if (action.startsWith('deleted file')) {
      const content = [files, action].join("\n")
      cleanedChanges.push({ content, filepath, file, extension, commits, tokens: countTokens(content, model, cache_path) })
    } else if (action.startsWith("new file") || action.startsWith("index") || action.startsWith("similarity")) {
      if (binaryExtensions.includes(extension)) {
        const content = [files, action].join("\n")
        cleanedChanges.push({ content, filepath, file, extension, commits, tokens: countTokens(content, model, cache_path) })  
      } else {
        cleanedChanges.push({ content: change, filepath, file, extension, commits, tokens: countTokens(change, model, cache_path) })  
      }
    } else {
      throw new Error("Unhandled action type:" + action)
    }
  })

  const sortedChanges = cleanedChanges.sort((a, b) => b.tokens - a.tokens)
  sortedChanges
    .forEach(change => {
      if (change.tokens > 5000) {
        console.warn("Long file change:", change.tokens, change.filepath)
        console.warn(change.commits)
      }
    })

  if (output) console.log("Bucketing...")
  const included_commits = {}
  const included_files = {}
  const buckets = []
  let current_bucket_commits = {}
  let current_bucket = []

  const findNextCommit = () => {
    const file = cleanedChanges.find(change => !included_files[change.filepath] && Object.keys(change.commits).find((commit) => !included_commits[commit]))
    if (!file) return []
    const commit = Object.keys(file.commits).find((commit) => !included_commits[commit])
    return [commit, file.commits[commit]]
  }

  const getAllCommitFiles = (commit) => {
    return cleanedChanges.filter(change => {
      if (included_files[change.filepath]) return false
      return !!change.commits[commit]
    })
  }

  let tokens_limit = max_completion_tokens - 4000
  let tokens_count = 0
  let ready = false
  let commit
  let message
  while (true) {
    if (!commit) {
      [commit, message] = findNextCommit()
    }
    if (!commit) break

    const files = getAllCommitFiles(commit)
    while (files.length > 0) {
      const file = files[0]
      if (tokens_count + file.tokens < tokens_limit) {
        if (!current_bucket_commits[commit]) current_bucket_commits[commit] = message
        current_bucket.push(file)
        tokens_count += file.tokens
        included_files[file.filepath] = true
        files.shift()
      } else if (file.tokens >= tokens_limit) {
        if (!current_bucket_commits[commit]) current_bucket_commits[commit] = message
        console.warn("Long file ignored:", file.tokens, file.filepath)
        included_files[file.filepath] = true
        files.shift()
      } else {
        ready = true
        break
      }
    }
    
    if (files.length == 0) {
      included_commits[commit] = true
      commit = false
    }

    if (ready) {
      buckets.push({
        commits: current_bucket_commits,
        files: current_bucket
      })
      current_bucket = []
      current_bucket_commits = {}
      tokens_count = 0
      ready = false
    }

  }

  if (current_bucket.length > 0 || Object.keys(current_bucket_commits).length > 0) {
    buckets.push({
      commits: current_bucket_commits,
      files: current_bucket
    })
  }

  if (output) console.log("Summary...")
  buckets.forEach((bucket, index) => {
    const tokens = bucket.files.reduce((memo, file) => memo + file.tokens, 0)  
    if (output) console.log(`Bucket ${index + 1}, ${bucket.files.length} files, ${tokens} tokens, ${Object.keys(bucket.commits).length} commits`)
  })

  const total = buckets.reduce((memo, bucket) => {
    return memo + bucket.files.length
  }, 0)

  if (total != cleanedChanges.length) {
    throw new Error("Internal error in bucketing process")
  }

  if (output) console.log("Generating release notes...")
  const release_notes = []
  
  const promises = buckets.map(async (bucket) => {
    const commits = Object.values(bucket.commits).join("\n")
    const diffs = bucket.files.map(file => file.content).join("\n")
    const diffContent = "COMMITS\n" + commits + '\n\nDIFF' + diffs

    const notes = await generateReleaseNotes(diffContent, model, max_completion_tokens, language, additional_context, cache_path)
    release_notes.push(notes)
  })

  await Promise.allSettled(promises)

  const final_notes = await mergeReleaseNotes(release_notes, model, max_completion_tokens, language, cache_path)
  if (!final_notes) {
    console.error("Error generating final release notes")
    process.exit(1)
  }

  if (!output) {
    console.log(release_notes.join("\n"))
  } else {
    fs.writeFile(output, final_notes, (err) => {
      if (err) {
        console.error(`Error writing release notes to file: ${output}`)
      } else {
        console.log(`Release notes generated: ${output}`)
      }
    })  
  }
}

module.exports = { generate }