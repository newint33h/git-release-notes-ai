# Git Release Notes AI

Git Release Notes AI is a command-line tool designed to generate release notes for your Git projects using AI. This tool helps automate the creation of comprehensive release notes by analyzing commit history and generating descriptions in multiple languages.

## Features

- Specify project directory and Git commit range.
- Generate release notes in multiple languages.
- Customize the output file for release notes.
- Option to use AI models for generating notes with additional context.
- Capability to exclude specific files and extensions from analysis.

## Installation

To install the tool, simply clone the repository and run:

```sh
npm install -g git-release-notes-ai
```

## Usage

To run the tool, use the following command-line syntax:

```sh
npx git-release-notes-ai [options]
```

### Options

- `-p, --project-path`: Path to the project folder. **Required.**
- `-r, --git-range`: Git range for commits (e.g., `main..develop`). **Required.**
- `-l, --language`: Language for the release notes (e.g., `english`, `spanish`). **Required.**
- `-o, --output`: Output file where to store release notes.
- `-c, --cache-path`: Path to cache files, useful for debugging.
- `-m, --model`: AI model to use for generation. Specify this if needed.
- `-t, --max-completion-tokens`: Maximum number of completion tokens. Required if model is set. Minimum 8000 tokens.
- `-a, --additional-context`: Additional context to provide to the AI for better descriptions.
- `-e, --exclude-file`: File to exclude from processing. Repeatable.
- `-x, --exclude-ext`: Extension to exclude from processing. Repeatable.

## Example

Here is an example of how to execute the command:

```sh
git-release-notes-ai \
   -p ../MyProject \ 
   -r 9d4ba8d3280fb54e468bc2ca79ab35eaae1bb028..HEAD \
   -l spanish \
   -o notes.txt
```

This command generates release notes for the project located in `../MyProject`, considering the commits from the specified Git range, and outputs the notes in Spanish to `notes.txt`.

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key is required to use this tool.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License.