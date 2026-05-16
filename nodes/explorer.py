"""Explorer node - searches web for recipes."""
import json
from state import MealState
from config import llm, search

NUM_RECIPES = 1

def explorer_node(state: MealState):
    print("[Explorer] Searching web...")
    query = "healthy 30-minute dinner recipes no processed foods fresh protein"
    results = search.run(query)

    # extract recipes from search results

    print("[Explorer] Structuring web results as recipes...")
    prompt = f"""
    From these search results, extract {NUM_RECIPES} recipe ideas and format as JSON.
    Return a JSON array with objects containing: title, protein, ingredients (list), instructions (list)
    ingredients should be simple items with measurements for the recipe
    instructions should be concise steps that can be followed to make the recipe

    Search results:
    {results}

    Format:
    [
      {{"title": "Recipe Name", "protein": "Protein Type", "ingredients": ["item1", "item2"], "instructions": ["step1", "step2"]}},
      ...
    ]

    Return ONLY the JSON array, no other text.
    """
    response = llm.invoke(prompt)

    #print(f"[Explorer] LLM response: {response}")

    try:
        recipes = json.loads(response)
        if not isinstance(recipes, list):
            recipes = [recipes]
        print(f"[Explorer] Extracted {len(recipes)} recipes from web")
        return {"internet_recipes": recipes}
    except json.JSONDecodeError:
        print("[Explorer] Failed to parse LLM response as JSON")
        return {"internet_recipes": []}
