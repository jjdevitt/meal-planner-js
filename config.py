"""Shared configuration for meal planner agents."""
from langchain_ollama import OllamaLLM
from langchain_community.tools import DuckDuckGoSearchResults
from langchain_community.tools import DuckDuckGoSearchRun

# shared config for meal planner

# Initialize Models
llm = OllamaLLM(model="llama3")
search = DuckDuckGoSearchRun()
jsonSearch = DuckDuckGoSearchResults(output_format="json")