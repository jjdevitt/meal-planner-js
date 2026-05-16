Agents that plan a meal week:
	supervisor - watches the other Agents
	librarian - goes through known/stored recipies in a json database 
	explorer - uses DDG to search the internet and llm to generate recipiies
	planner (llm) - merges the previous two recipes and makes selections
	shopper - makes a grocery list from the final meal plan
	sous_chef - writes individual recipes out to the filesystem

# pre-steps
	need homebrew, python3, and ollama 3

	install homebrew on macos
	/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

	install python3
	brew install python

	install ollama
	brew install ollama

# SETUP 
## create a python virtual environment
	python3 -m venv venv
	source venv/bin/activate
	pip3 install langgraph langchain-ollama langchain-community duckduckgo-search

# Running
	ollama serve (seperate window)
	python main.py

# TODO
 deep_explorer - web crawler for better recipes... runs really slow
 historian - keep track of previous recipes selection