#!/usr/bin/env node

const yargs = require("yargs/yargs")
const { hideBin } = require("yargs/helpers")
const { generate } = require("./generate")

const argv = yargs(hideBin(process.argv))
  .usage("Usage: npx git-release-notes-ai [options]")
  .option("project-path", {
    alias: "p",
    type: "string",
    describe: "Path to the project folder",
    demandOption: true,
  })
  .option("git-range", {
    alias: "r",
    type: "string",
    describe: "Git range for commits (e.g., main..develop)",
    demandOption: true,
  })
  .option("language", {
    alias: "l",
    type: "string",
    describe: "Language to use for the release notes (e.g., english, spanish, etc.)",
    demandOption: true,
  })
  .option("output", {
    alias: "o",
    type: "string",
    describe: "Output file where to store release notes",
  })
  .option("cache-path", {
    alias: "c",
    type: "string",
    describe: "Path to cache files (useful for debugging)",
  })
  .option("model", {
    alias: "m",
    type: "string",
    describe: "AI model to use for generation",
  })
  .option("max-completion-tokens", {
    alias: "t",
    type: "number",
    describe: "Maximum number of completion tokens (required if model is set)",
  })
  .option("additional-context", {
    alias: "a",
    type: "string",
    describe: "Additional context to provide to the AI for better descriptions",
  })
  .option("exclude-file", {
    alias: "e",
    type: "string",
    describe: "File to exclude",
    array: true,
  })
  .option("exclude-ext", {
    alias: "x",
    type: "string",
    describe: "Extension to exclude",
    array: true,
  })
  .check((argv) => {
    if (argv.model && typeof argv["max-completion-tokens"] === "undefined") {
      throw new Error(
        "--max-completion-tokens is required when --model is set."
      )
    }
    return true
  })
  .check((argv) => {
    if (argv["max-completion-tokens"] && parseInt(argv["max-completion-tokens"]) < 8000) {
      throw new Error(
        "--max-completion-tokens must be a minimum of 8000 tokens."
      )
    }
    return true
  })
  .env("OPENAI")
  .demandOption("apiKey", "OPENAI_API_KEY is required in environment")
  .help()
  .alias("help", "h")
  .alias("version", "v").argv

generate({
  projectPath: argv.projectPath,
  gitRange: argv.gitRange,
  language: argv.language,
  additional_context: argv.additionalContext,
  model: argv.model,
  max_completion_tokens: argv.maxCompletionTokens,
  exclude_files: argv.excludeFile,
  exclude_ext: argv.excludeExt,
  output: argv.output,
  cache_path: argv.cachePath
})
