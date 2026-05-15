setup steps (need python installed)

create a python virtual environment

python3 -m venv venv
source venv/bin/activate

install required packages

pip3 install langgraph langchain-ollama langchain-community duckduckgo-search

prepare project

ensure recipes.json exists in project root
create meal_plans directory or let the program create it

run the planner

python main.py