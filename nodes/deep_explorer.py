"""Explorer node - searches web for recipes and loads webpages."""
import json
import re
from state import MealState
from config import llm, jsonSearch
from langchain_community.document_loaders import WebBaseLoader


def extract_urls(text: str) -> list[str]:
    """Extract URLs from search results."""
    url_pattern = r'https?://[^\s\)"\]]+'
    urls = re.findall(url_pattern, text)
    return list(set(urls))[:3]  # Get top 3 unique URLs


def load_and_parse_webpage(url: str) -> str:
    """Load webpage and extract content."""
    try:
        loader = WebBaseLoader([url])
        docs = loader.load()
        if docs:
            return docs[0].page_content
        return ""
    except Exception as e:
        print(f"[Explorer] Failed to load {url}: {e}")
        return ""


def explorer_node(state: MealState):
    print("[Explorer] Searching web for recipes...")
    query = "healthy 30-minute dinner recipes no processed foods fresh protein"
    results = jsonSearch.run(query)

    print("[Explorer] Extracting recipe URLs...")
    urls = extract_urls(results)

    webpage_content = []
    for url in urls:
        print(f"[Explorer] Loading {url}...")
        content = load_and_parse_webpage(url)
        if content:
            webpage_content.append(content)

    if not webpage_content:
        print("[Explorer] No webpages loaded successfully")
        return {"internet_recipes": []}

    combined_content = "\n\n".join(webpage_content)

    print("[Explorer] Extracting recipes from webpages...")
    prompt = f"""
    From the following recipe webpages, extract 2-3 complete recipes and format as JSON.
    Return a JSON array with objects containing: title, protein, ingredients (list), instructions (list)

    Webpage content:
    {combined_content[:4000]}

    Format:
    [
      {{"title": "Recipe Name", "protein": "Protein Type", "ingredients": ["item1", "item2"], "instructions": ["step1", "step2"]}},
      ...
    ]

    Return ONLY the JSON array, no other text.
    """
    response = llm.invoke(prompt)

    try:
        recipes = json.loads(response)
        if not isinstance(recipes, list):
            recipes = [recipes]
        print(f"[Explorer] Extracted {len(recipes)} recipes from webpages")
        return {"internet_recipes": recipes}
    except json.JSONDecodeError:
        print("[Explorer] Failed to parse LLM response as JSON")
        return {"internet_recipes": []}
