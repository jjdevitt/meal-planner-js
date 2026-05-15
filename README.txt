Agents that plan a meal week:
 supervisor - watches the other Agents
 librarian - goes through known/stored recipies in a json database 
 explorer - uses DDG to search the internet and llm to generate recipiies
 planner (llm) - merges the previous two recipes and makes selections
 sous_chef - writes individual recipes out to the filesystem

# pre-steps
Need Python3 and Ollama 3 (https://docs.ollama.com/quickstart)

# create a python virtual environment
python3 -m venv venv
source venv/bin/activate

# install required packages

pip3 install langgraph langchain-ollama langchain-community duckduckgo-search

# prepare project

ensure recipes.json exists in project root
create meal_plans directory or let the program create it

run the planner

python main.py

# TODO
 deep_explorer - web crawler for better recipes... runs really slow
 historian - keep track of previous recipes selection