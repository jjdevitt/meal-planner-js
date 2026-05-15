from langchain_community.tools import DuckDuckGoSearchResults

# Initialize the tool
search = DuckDuckGoSearchResults(output_format="json")

# Run a query
results = search.invoke("list Recipes for healthy 30-minute dinner recipes no processed foods fresh protein")
print(results)
