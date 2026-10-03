# Meal Planner

A team of local AI agents that plans your week of dinners. It runs entirely on your machine using
[Ollama](https://ollama.com) and comes with a desktop app (Electron) where you can tell the planner what
you like and watch each agent work in real time. A command-line version is included too.

## The agents

| Agent | What it does |
| --- | --- |
| **Supervisor** | Watches the other agents and decides who runs next |
| **Librarian** | Picks recipes from the local `recipes.json` database (skipping ones that clash with your diet / avoid list) |
| **Explorer** | Searches the web with DuckDuckGo and uses the LLM to turn the results into recipes |
| **Planner** (LLM) | Merges the local and web recipes and selects the week's meals |
| **Shopper** | Builds a grocery list from the final meal plan |
| **Sous Chef** | Writes each recipe out to the `meal_plans/` folder |
| **Historian** | Records each plan (and the preferences used) in `history.json` |

The agents are wired together with [LangGraph.js](https://github.com/langchain-ai/langgraphjs):
every agent reports back to the Supervisor, which routes to the next one until the plan is done.

## Prerequisites

- **Node.js 22.12 or newer** (includes `npm`) — https://nodejs.org
- **Ollama** — https://ollama.com/download
- **Git** to clone the repository

On macOS with [Homebrew](https://brew.sh):

```bash
brew install node ollama
```

On Windows / Linux, use the installers from the links above (Linux: `curl -fsSL https://ollama.com/install.sh | sh`).

## Setup

```bash
# 1. Get the code
git clone https://github.com/jjdevitt/meal-planner-js.git
cd meal-planner-js

# 2. Install dependencies (Electron downloads itself the first time you run the app)
npm install

# 3. Download the language model (~4.7 GB, one time)
ollama pull llama3
```

## Running the desktop app

1. Start Ollama in a separate terminal (skip this if the Ollama desktop app is already running):

   ```bash
   ollama serve
   ```

2. Launch the app:

   ```bash
   npm start
   ```

3. Fill in your preferences — diet, number of meals, max cooking time, favorite cuisines,
   allergies / ingredients to avoid, and any free-form notes — then click **Plan my meals**.
   Your preferences are remembered for next time.

4. Watch the run: the **Agents** panel highlights which agent is working right now and what each one
   produced, and the **Activity** log streams every step (including the LLM's live output — untick
   *Show live LLM output* to hide it). You can **Cancel** at any time.

5. When it's done you get the meal plan (click a recipe to expand it), the grocery list, and buttons to
   open each generated file.

The status pill in the top-right corner shows whether Ollama is reachable and the model is downloaded.
Click it to re-check. You can change the model or Ollama URL under **Ollama settings** in the form.

## Running from the command line

```bash
npm run cli
```

Pass preferences as flags (all optional):

```bash
npm run cli -- --diet vegetarian --meals 5 --max-minutes 30 \
  --cuisines "thai, mexican" --avoid "peanuts, mushrooms" --notes "cooking for two"
```

Run `npm run cli -- --help` for all options (`--model`, `--host`, `--verbose` to stream LLM output).

## Output

| File | Contents |
| --- | --- |
| `meal_plans/day_01_<Recipe>.txt` … | One file per planned recipe (ingredients + numbered steps) |
| `meal_plans/grocery_list.txt` | De-duplicated grocery list for the week |
| `history.json` | Every plan generated, with date and preferences |

When running from source these are written to the project folder. A packaged app (see below) writes them
to the per-user app data folder instead (e.g. `~/Library/Application Support/meal-planner` on macOS).

## Configuration

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_MODEL` | `llama3` | Model used by the Explorer and Planner |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama server URL |
| `OLLAMA_NUM_CTX` | `8192` | Context window passed to Ollama (long recipe prompts need more than Ollama's default) |
| `OLLAMA_NUM_PREDICT` | `4096` | Max tokens the LLM may generate per call |
| `MEAL_PLANNER_DATA_DIR` | project folder | Where `history.json` and `meal_plans/` are written |
| `MEAL_PLANNER_RECIPES` | `./recipes.json` | Local recipe database used by the Librarian |

Smaller models (e.g. `ollama pull llama3.2` then `OLLAMA_MODEL=llama3.2 npm start`) run much faster on
machines without a GPU, at some cost in plan quality.

To add your own recipes, append objects to `recipes.json` in this shape:

```json
{ "title": "Recipe Name", "protein": "Chicken", "ingredients": ["1 lb chicken"], "instructions": ["Step one"] }
```

## Other commands

```bash
npm test             # unit tests (no Ollama needed)
npm run search-test  # check that DuckDuckGo web search works from your network
npm run dist         # build a distributable app (dmg / nsis / AppImage) into dist/
```

## Troubleshooting

- **"Ollama not reachable"** — make sure `ollama serve` (or the Ollama app) is running, and that the URL
  under *Ollama settings* matches.
- **"Model not found"** — run `ollama pull <model>` for the model shown in the status pill.
- **"Web search failed … falling back to LLM-only ideas"** — DuckDuckGo occasionally rate-limits
  requests. The Explorer then asks the LLM to suggest recipes on its own; try again later for web results.
- **Electron fails to download on first run** — delete `node_modules/electron` and run `npm install` again.

## Project layout

```
electron/            Desktop app (main process, preload bridge, renderer UI)
src/graph.js         LangGraph wiring + runMealPlanner() used by the UI and CLI
src/cli.js           Command-line entry point
src/nodes/           One file per agent
src/preferences.js   Preference normalization, prompt text, diet filters
src/config.js        Ollama / DuckDuckGo setup and file paths
test/                node:test unit tests
recipes.json         Local recipe database
history.json         Previously generated plans
```

## TODO

- deep_explorer — web crawler for better recipes (runs really slow)
